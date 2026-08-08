'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Download,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { readRetailApi } from '@/shared/lib/retail-client';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

type WorkbenchModule = {
  id: string;
  title: string;
  description: string;
  icon: string;
  url?: string;
};

type LedgerRow = {
  id?: string;
  name: string;
  enterpriseName?: string;
  industry: string;
  cashflow: string;
  loan: string;
  followup: string;
  priority: string;
  segment: string;
  ownerUserId?: string;
  canEdit?: boolean;
  version?: number;
};

type MaterialItem = {
  title: string;
  description: string;
  complete: boolean;
};

type BusinessField = {
  label: string;
  value: string;
};

type FollowupTask = {
  id?: string;
  title: string;
  reminderDate?: string;
  status?: 'pending' | 'done';
};

type BusinessSnapshot = {
  exists: boolean;
  customerId: string;
  canEdit: boolean;
  version: number;
  ruleVersion: string;
  interview: { notes: string; outputs: BusinessField[] };
  document: {
    fileName: string;
    fields: BusinessField[];
    reviewed: boolean;
  };
  profile: {
    fields: BusinessField[];
    completeness: number;
    tags: string[];
  };
  matching: { products: any[] };
  scripts: Array<{ title: string; content: string }>;
  materials: { items: MaterialItem[]; tasks: FollowupTask[] };
  summary: { metrics: any[]; sections: any[] };
};

function businessFieldKey(label: string) {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    企业名称: 'enterprise-name',
    客户名称: 'enterprise-name',
    enterprisename: 'enterprise-name',
    companyname: 'enterprise-name',
    统一社会信用代码: 'social-credit-code',
    socialcreditcode: 'social-credit-code',
    经营者: 'operator',
    法定代表人: 'operator',
    operator: 'operator',
    成立日期: 'established-date',
    establishmentdate: 'established-date',
    经营范围: 'business-scope',
    businessscope: 'business-scope',
    识别置信度: 'confidence',
    confidence: 'confidence',
  };

  return aliases[normalized] || normalized;
}

function mergeEditedBusinessFields(
  latestFields: BusinessField[],
  baselineFields: BusinessField[],
  editedFields: BusinessField[]
) {
  if (!latestFields.length) {
    return editedFields.map((field) => ({ ...field }));
  }

  const baselineValues = new Map(
    baselineFields.map((field) => [businessFieldKey(field.label), field.value])
  );
  const changes = editedFields.filter((field) => {
    const key = businessFieldKey(field.label);
    return !baselineValues.has(key) || baselineValues.get(key) !== field.value;
  });
  const merged = latestFields.map((field) => ({ ...field }));

  for (const change of changes) {
    const key = businessFieldKey(change.label);
    const index = merged.findIndex(
      (field) => businessFieldKey(field.label) === key
    );
    if (index >= 0) {
      merged[index] = { ...merged[index], value: change.value };
    } else {
      merged.push({ ...change });
    }
  }

  return merged;
}

function getEnterpriseName(fields: BusinessField[]) {
  return (
    fields.find((field) => businessFieldKey(field.label) === 'enterprise-name')
      ?.value || ''
  );
}

const emptyLedgerEntry: LedgerRow = {
  name: '',
  industry: '',
  cashflow: '',
  loan: '',
  followup: '',
  priority: '',
  segment: 'all',
};

function parseCsvRow(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizePersonName(name: string) {
  return name.trim();
}

function getCustomerNumber(id: string, fallbackName = '') {
  const source = id || fallbackName || 'customer';
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(1_000_000 + ((hash >>> 0) % 9_000_000));
}

export function RetailWorkbench({ section }: { section: Section }) {
  const modules = (section.modules ?? []) as WorkbenchModule[];
  const copy = section.copy as any;
  const [activeId, setActiveId] = useState(
    (section.default_module as string) ?? modules[0]?.id ?? 'ledger'
  );
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerRow[]>(() => [
    ...(copy.ledger.rows as LedgerRow[]),
  ]);
  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [ledgerDraft, setLedgerDraft] = useState<LedgerRow>(emptyLedgerEntry);
  const [pendingCustomerId, setPendingCustomerId] = useState('');
  const [pendingCustomerName, setPendingCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const ledgerImportInputRef = useRef<HTMLInputElement>(null);
  const [ocrReviewed, setOcrReviewed] = useState(false);
  const [selectedMaterialName, setSelectedMaterialName] = useState('');
  const materialInputRef = useRef<HTMLInputElement>(null);
  const [interviewText, setInterviewText] = useState(
    copy.interview.sample as string
  );
  const [interviewReady, setInterviewReady] = useState(true);
  const [interviewOutputs, setInterviewOutputs] = useState<BusinessField[]>(
    copy.interview.outputs as BusinessField[]
  );
  const [ocrFields, setOcrFields] = useState<BusinessField[]>(
    copy.ocr.fields as BusinessField[]
  );
  const [profileFields, setProfileFields] = useState<BusinessField[]>(
    copy.profile.fields as BusinessField[]
  );
  const [profileCompleteness, setProfileCompleteness] = useState(
    Number.parseInt(String(copy.profile.completeness), 10) || 0
  );
  const [profileTags, setProfileTags] = useState<string[]>(
    copy.profile.tags as string[]
  );
  const [matchReady, setMatchReady] = useState(true);
  const [matchingProducts, setMatchingProducts] = useState<any[]>(
    copy.matching.products as any[]
  );
  const [scriptScenario, setScriptScenario] = useState(0);
  const [scripts, setScripts] = useState<
    Array<{ title: string; content: string }>
  >(copy.scripts.scenarios as Array<{ title: string; content: string }>);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>(
    copy.materials.items as MaterialItem[]
  );
  const [materialChecked, setMaterialChecked] = useState<Set<number>>(
    new Set(
      (copy.materials.items as MaterialItem[])
        .map((item, index) => (item.complete ? index : -1))
        .filter((index) => index >= 0)
    )
  );
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReminderDate, setTaskReminderDate] = useState('2026-08-08');
  const [tasks, setTasks] = useState<FollowupTask[]>(
    (copy.followup.tasks as string[]).map((title) => ({
      title,
      reminderDate: '',
      status: 'pending',
    }))
  );
  const [summaryMetrics, setSummaryMetrics] = useState<any[]>(
    copy.summary.metrics as any[]
  );
  const [summarySections, setSummarySections] = useState<any[]>(
    copy.summary.sections as any[]
  );
  const [businessCanEdit, setBusinessCanEdit] = useState(true);
  const businessVersionRef = useRef(0);
  const documentBaselineRef = useRef<BusinessField[]>(
    copy.ocr.fields as BusinessField[]
  );
  const [savedMessage, setSavedMessage] = useState('');
  const savedMessageIsError =
    /失败|错误|请先登录|接口返回|无法|不存在|request failed|invalid json/i.test(
      savedMessage
    );

  useEffect(() => {
    let cancelled = false;

    const loadCustomers = async () => {
      try {
        let data = await readRetailApi<{ list: LedgerRow[] }>(
          await fetch('/api/retail/customers?limit=500', {
            credentials: 'same-origin',
            cache: 'no-store',
          })
        );

        if (!data.list.length) {
          data = await readRetailApi<{ list: LedgerRow[] }>(
            await fetch('/api/retail/customers/bootstrap', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows: copy.ledger.rows }),
            }),
            { method: 'POST', url: '/api/retail/customers/bootstrap' }
          );
        }

        if (!cancelled) {
          setLedgerEntries(data.list);
        }
      } catch (error) {
        if (!cancelled) {
          setSavedMessage(
            error instanceof Error ? error.message : copy.ledger.request_error
          );
        }
      }
    };

    void loadCustomers();
    return () => {
      cancelled = true;
    };
  }, [copy.ledger.request_error, copy.ledger.rows]);

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const moduleId = searchParams.get('module');
    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customer');
    if (customerId || customerName) {
      const customerDisplayName = normalizePersonName(customerName || '');
      setPendingCustomerId(customerId || '');
      setPendingCustomerName(customerDisplayName);
      setSelectedCustomerId(customerId || '');
      setSelectedCustomerName(customerDisplayName);
    }
    if (moduleId && modules.some((item) => item.id === moduleId)) {
      setActiveId(moduleId);
    } else if (
      section.default_module &&
      modules.some((item) => item.id === section.default_module)
    ) {
      setActiveId(section.default_module as string);
    }
  }, [modules, section.default_module]);

  useEffect(() => {
    if (!ledgerEntries.length) return;

    if (selectedCustomerId) {
      const selectedCustomer = ledgerEntries.find(
        (row) => row.id === selectedCustomerId
      );
      if (selectedCustomer && selectedCustomer.name !== selectedCustomerName) {
        const customerName = normalizePersonName(selectedCustomer.name);
        setPendingCustomerName(customerName);
        setSelectedCustomerName(customerName);
        const selectedUrl = new URL(window.location.href);
        selectedUrl.searchParams.set('customer', customerName);
        window.history.replaceState({}, '', selectedUrl);
      }
      return;
    }

    if (activeId === 'ledger') return;

    const url = new URL(window.location.href);
    const requestedCustomerName = normalizePersonName(
      url.searchParams.get('customer') || ''
    );
    const customer =
      ledgerEntries.find(
        (row) =>
          row.id &&
          requestedCustomerName &&
          normalizePersonName(row.name) === requestedCustomerName
      ) || ledgerEntries.find((row) => row.id && row.canEdit !== false);

    if (!customer?.id) return;

    const customerName = normalizePersonName(customer.name);
    setPendingCustomerId(customer.id);
    setPendingCustomerName(customerName);
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customerName);
    url.searchParams.set('customerId', customer.id);
    url.searchParams.set('customer', customerName);
    window.history.replaceState({}, '', url);
  }, [activeId, ledgerEntries, selectedCustomerId, selectedCustomerName]);

  useEffect(() => {
    let cancelled = false;

    const resetBusinessState = () => {
      businessVersionRef.current = 0;
      setBusinessCanEdit(true);
      setInterviewText(copy.interview.sample as string);
      setInterviewOutputs(copy.interview.outputs as BusinessField[]);
      setInterviewReady(true);
      setSelectedMaterialName('');
      setOcrFields(copy.ocr.fields as BusinessField[]);
      documentBaselineRef.current = (copy.ocr.fields as BusinessField[]).map(
        (field) => ({ ...field })
      );
      setOcrReviewed(false);
      setProfileFields(copy.profile.fields as BusinessField[]);
      setProfileCompleteness(
        Number.parseInt(String(copy.profile.completeness), 10) || 0
      );
      setProfileTags(copy.profile.tags as string[]);
      setMatchingProducts(copy.matching.products as any[]);
      setMatchReady(true);
      setScripts(
        copy.scripts.scenarios as Array<{ title: string; content: string }>
      );
      const defaultItems = copy.materials.items as MaterialItem[];
      setMaterialItems(defaultItems);
      setMaterialChecked(
        new Set(
          defaultItems
            .map((item, index) => (item.complete ? index : -1))
            .filter((index) => index >= 0)
        )
      );
      setTasks(
        (copy.followup.tasks as string[]).map((title) => ({
          title,
          reminderDate: '',
          status: 'pending',
        }))
      );
      setSummaryMetrics(copy.summary.metrics as any[]);
      setSummarySections(copy.summary.sections as any[]);
    };

    const applySnapshot = (data: BusinessSnapshot) => {
      businessVersionRef.current = data.version;
      setBusinessCanEdit(data.canEdit);
      setInterviewText(
        data.interview.notes || (copy.interview.sample as string)
      );
      setInterviewOutputs(
        data.interview.outputs.length
          ? data.interview.outputs
          : (copy.interview.outputs as BusinessField[])
      );
      setInterviewReady(Boolean(data.interview.outputs.length));
      setSelectedMaterialName(data.document.fileName || '');
      const documentFields = data.document.fields.length
        ? data.document.fields
        : (copy.ocr.fields as BusinessField[]);
      setOcrFields(documentFields);
      documentBaselineRef.current = documentFields.map((field) => ({
        ...field,
      }));
      setOcrReviewed(data.document.reviewed);
      setProfileFields(
        data.profile.fields.length
          ? data.profile.fields
          : (copy.profile.fields as BusinessField[])
      );
      setProfileCompleteness(
        data.profile.fields.length
          ? data.profile.completeness
          : Number.parseInt(String(copy.profile.completeness), 10) || 0
      );
      setProfileTags(
        data.profile.tags.length
          ? data.profile.tags
          : (copy.profile.tags as string[])
      );
      setMatchingProducts(
        data.matching.products.length
          ? data.matching.products
          : (copy.matching.products as any[])
      );
      setMatchReady(Boolean(data.matching.products.length));
      setScripts(
        data.scripts.length
          ? data.scripts
          : (copy.scripts.scenarios as Array<{
              title: string;
              content: string;
            }>)
      );
      const items = data.materials.items.length
        ? data.materials.items
        : (copy.materials.items as MaterialItem[]);
      setMaterialItems(items);
      setMaterialChecked(
        new Set(
          items
            .map((item, index) => (item.complete ? index : -1))
            .filter((index) => index >= 0)
        )
      );
      setTasks(
        data.materials.tasks.length
          ? data.materials.tasks
          : (copy.followup.tasks as string[]).map((title) => ({
              title,
              reminderDate: '',
              status: 'pending' as const,
            }))
      );
      setSummaryMetrics(
        data.summary.metrics.length
          ? data.summary.metrics
          : (copy.summary.metrics as any[])
      );
      setSummarySections(
        data.summary.sections.length
          ? data.summary.sections
          : (copy.summary.sections as any[])
      );
    };

    const loadBusiness = async () => {
      if (!selectedCustomerId) {
        resetBusinessState();
        return;
      }
      try {
        const data = await readRetailApi<BusinessSnapshot>(
          await fetch(`/api/retail/customers/${selectedCustomerId}/business`, {
            credentials: 'same-origin',
            cache: 'no-store',
          })
        );
        if (!cancelled && data.version >= businessVersionRef.current) {
          applySnapshot(data);
        }
      } catch (error) {
        if (!cancelled) {
          setSavedMessage(
            error instanceof Error ? error.message : copy.ledger.request_error
          );
        }
      }
    };

    void loadBusiness();
    return () => {
      cancelled = true;
    };
  }, [activeId, selectedCustomerId, copy]);

  const updateBusiness = async (
    module: string,
    data: Record<string, unknown>
  ) => {
    if (!selectedCustomerId) {
      throw new Error(copy.shared.select_customer);
    }
    if (!businessCanEdit) {
      throw new Error(copy.shared.owner_only);
    }

    const businessUrl = `/api/retail/customers/${selectedCustomerId}/business`;
    const sendUpdate = () =>
      fetch(businessUrl, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, data }),
      }).then((response) =>
        readRetailApi<BusinessSnapshot>(response, {
          method: 'PATCH',
          url: businessUrl,
        })
      );

    let snapshot: BusinessSnapshot;
    try {
      snapshot = await sendUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!/已发生变化|has changed/i.test(message)) throw error;
      // A second page for the same customer may have completed a save first.
      // Re-run once so the server selects the latest case version.
      snapshot = await sendUpdate();
    }
    businessVersionRef.current = snapshot.version;
    setBusinessCanEdit(snapshot.canEdit);
    return snapshot;
  };

  const activeModule =
    modules.find((item) => item.id === activeId) ?? modules[0];

  const ledgerRows = useMemo(() => {
    const query = ledgerQuery.trim().toLowerCase();
    return ledgerEntries.filter((row) => {
      const matchesQuery =
        !query || `${row.name} ${row.industry}`.toLowerCase().includes(query);
      const matchesFilter =
        ledgerFilter === 'all' || row.segment === ledgerFilter;
      return matchesQuery && matchesFilter;
    });
  }, [ledgerEntries, ledgerFilter, ledgerQuery]);

  const ledgerResultCount =
    ledgerFilter === 'all' && !ledgerQuery.trim()
      ? (Number(copy.ledger.total_count) || ledgerRows.length) +
        Math.max(
          0,
          ledgerEntries.length - (copy.ledger.rows as LedgerRow[]).length
        )
      : ledgerRows.length;

  const updateLedgerDraft = (field: keyof LedgerRow, value: string) => {
    setLedgerDraft((current) => ({ ...current, [field]: value }));
  };

  const handleLedgerSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!ledgerDraft.name.trim() || !ledgerDraft.industry.trim()) return;

    try {
      const isEditing = Boolean(ledgerDraft.id);
      const method = isEditing ? 'PATCH' : 'POST';
      const ledgerUrl = isEditing
        ? `/api/retail/customers/${ledgerDraft.id}`
        : '/api/retail/customers';
      const created = await readRetailApi<LedgerRow>(
        await fetch(ledgerUrl, {
          method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...ledgerDraft,
            name: ledgerDraft.name.trim(),
            industry: ledgerDraft.industry.trim(),
          }),
        }),
        { method, url: ledgerUrl }
      );
      setLedgerEntries((current) =>
        isEditing
          ? current.map((row) => (row.id === created.id ? created : row))
          : [created, ...current]
      );
      setLedgerDraft(emptyLedgerEntry);
      setIsLedgerFormOpen(false);
      setLedgerFilter('all');
      setLedgerQuery('');
      setSavedMessage(
        isEditing ? copy.ledger.update_success : copy.ledger.entry_success
      );
    } catch (error) {
      setSavedMessage(
        error instanceof Error ? error.message : copy.ledger.request_error
      );
    }
  };

  const handleLedgerImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const content = (await file.text()).replace(/^\uFEFF/, '');
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const imported = lines
        .slice(1)
        .map(parseCsvRow)
        .filter((values) => values.length >= 6 && values[0] && values[1])
        .map(
          (values): LedgerRow => ({
            name: normalizePersonName(values[0]),
            industry: values[1],
            cashflow: values[2] || '',
            loan: values[3] || '',
            followup: values[4] || '',
            priority: values[5] || '',
            segment: ['priority', 'maturity', 'unfollowed'].includes(values[6])
              ? values[6]
              : 'all',
          })
        );

      if (!imported.length) throw new Error('empty csv');
      const result = await readRetailApi<{ list: LedgerRow[]; count: number }>(
        await fetch('/api/retail/customers/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: imported }),
        }),
        { method: 'POST', url: '/api/retail/customers/import' }
      );
      setLedgerEntries((current) => [...result.list, ...current]);
      setLedgerFilter('all');
      setLedgerQuery('');
      setSavedMessage(
        copy.ledger.import_success.replace('{count}', String(imported.length))
      );
    } catch {
      setSavedMessage(copy.ledger.import_error);
    } finally {
      input.value = '';
    }
  };

  const handleLedgerExport = () => {
    const params = new URLSearchParams();
    if (ledgerQuery.trim()) params.set('q', ledgerQuery.trim());
    if (ledgerFilter !== 'all') params.set('segment', ledgerFilter);
    const url = `/api/retail/customers/export${params.size ? `?${params}` : ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = copy.ledger.export_filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setSavedMessage(copy.ledger.export_success);
  };

  const activateModule = (id: string) => {
    setActiveId(id);
    setSavedMessage('');
    const url = new URL(window.location.href);
    url.searchParams.set('module', id);
    window.history.replaceState({}, '', url);
  };

  const confirmCustomerSelection = () => {
    if (!pendingCustomerName) return;

    setSelectedCustomerId(pendingCustomerId);
    setSelectedCustomerName(pendingCustomerName);
    const url = new URL(window.location.href);
    if (pendingCustomerId) {
      url.searchParams.set('customerId', pendingCustomerId);
    }
    url.searchParams.set('customer', pendingCustomerName);
    window.history.replaceState({}, '', url);
    setSavedMessage(
      copy.ledger.confirm_success.replace('{name}', pendingCustomerName)
    );
  };

  const getModuleHref = (url: string) => {
    if (!selectedCustomerName) return url;

    const params = new URLSearchParams({ customer: selectedCustomerName });
    if (selectedCustomerId) params.set('customerId', selectedCustomerId);
    return `${url}?${params}`;
  };

  const editLedgerCustomer = (row: LedgerRow) => {
    if (!row.id || row.canEdit === false) return;
    setLedgerDraft({ ...row });
    setIsLedgerFormOpen(true);
    setSavedMessage('');
  };

  const deleteLedgerCustomer = async (row: LedgerRow) => {
    if (!row.id || row.canEdit === false) return;
    if (!window.confirm(copy.ledger.delete_confirm)) return;

    try {
      await readRetailApi<{ id: string }>(
        await fetch(`/api/retail/customers/${row.id}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }),
        { method: 'DELETE', url: `/api/retail/customers/${row.id}` }
      );
      setLedgerEntries((current) =>
        current.filter((item) => item.id !== row.id)
      );
      if (pendingCustomerId === row.id) {
        setPendingCustomerId('');
        setPendingCustomerName('');
      }
      if (selectedCustomerId === row.id) {
        setSelectedCustomerId('');
        setSelectedCustomerName('');
        const url = new URL(window.location.href);
        url.searchParams.delete('customerId');
        url.searchParams.delete('customer');
        window.history.replaceState({}, '', url);
      }
      setSavedMessage(copy.ledger.delete_success);
    } catch (error) {
      setSavedMessage(
        error instanceof Error ? error.message : copy.ledger.request_error
      );
    }
  };

  const saveInterview = async () => {
    try {
      const snapshot = await updateBusiness('interview', {
        notes: interviewText,
      });
      setInterviewOutputs(snapshot.interview.outputs);
      setInterviewReady(true);
      setSavedMessage(copy.shared.saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const saveDocument = async () => {
    try {
      if (!selectedCustomerId) {
        throw new Error(copy.shared.select_customer);
      }
      if (!businessCanEdit) {
        throw new Error(copy.shared.owner_only);
      }

      const baselineFields = documentBaselineRef.current.map((field) => ({
        ...field,
      }));
      const editedFields = ocrFields.map((field) => ({ ...field }));
      const businessUrl = `/api/retail/customers/${selectedCustomerId}/business`;
      const fetchLatest = async () =>
        readRetailApi<BusinessSnapshot>(
          await fetch(businessUrl, {
            credentials: 'same-origin',
            cache: 'no-store',
          })
        );
      const submit = async (
        latest: BusinessSnapshot,
        fields: BusinessField[]
      ) => {
        const response = await fetch(businessUrl, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'document',
            version: latest.version,
            data: {
              fileName: selectedMaterialName || latest.document.fileName || '',
              fields,
              profileFields: latest.profile.fields.length
                ? latest.profile.fields
                : profileFields,
              reviewed: true,
            },
          }),
        });

        if (response.status === 409) return null;
        return readRetailApi<BusinessSnapshot>(response, {
          method: 'PATCH',
          url: businessUrl,
        });
      };

      let latest = await fetchLatest();
      let mergedFields = mergeEditedBusinessFields(
        latest.document.fields,
        baselineFields,
        editedFields
      );
      let snapshot = await submit(latest, mergedFields);

      if (!snapshot) {
        latest = await fetchLatest();
        mergedFields = mergeEditedBusinessFields(
          latest.document.fields,
          baselineFields,
          editedFields
        );
        snapshot = await submit(latest, mergedFields);
      }

      if (!snapshot) {
        throw new Error('业务资料持续发生变化，请稍后重试');
      }

      const persisted = await fetchLatest();
      const expectedEnterpriseName = getEnterpriseName(mergedFields);
      if (
        expectedEnterpriseName &&
        (getEnterpriseName(persisted.document.fields) !==
          expectedEnterpriseName ||
          getEnterpriseName(persisted.profile.fields) !==
            expectedEnterpriseName)
      ) {
        throw new Error('企业名称保存后未正确同步，请重试');
      }

      businessVersionRef.current = persisted.version;
      setBusinessCanEdit(persisted.canEdit);
      setSelectedMaterialName(persisted.document.fileName || '');
      setOcrFields(persisted.document.fields);
      documentBaselineRef.current = persisted.document.fields.map((field) => ({
        ...field,
      }));
      setOcrReviewed(persisted.document.reviewed);
      setProfileFields(persisted.profile.fields);
      setProfileCompleteness(persisted.profile.completeness);
      setProfileTags(persisted.profile.tags);
      setSavedMessage(copy.ocr.sync_saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const saveProfile = async () => {
    try {
      const snapshot = await updateBusiness('profile', {
        fields: profileFields,
      });
      setProfileCompleteness(snapshot.profile.completeness);
      setProfileTags(snapshot.profile.tags);
      setSavedMessage(copy.shared.saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const recalculateMatching = async () => {
    try {
      const snapshot = await updateBusiness('matching', {
        recalculate: true,
      });
      setMatchingProducts(snapshot.matching.products);
      setMatchReady(true);
      setSavedMessage(copy.shared.saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const saveScript = async () => {
    const script = scripts[scriptScenario];
    if (!script) return;
    try {
      const snapshot = await updateBusiness('scripts', {
        scenarioIndex: scriptScenario,
        title: script.title,
        content: script.content,
      });
      setScripts(snapshot.scripts);
      setSavedMessage(copy.shared.saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const currentMaterialItems = () =>
    materialItems.map((item, index) => ({
      ...item,
      complete: materialChecked.has(index),
    }));

  const saveMaterials = async (nextTasks = tasks) => {
    try {
      const snapshot = await updateBusiness('materials', {
        items: currentMaterialItems(),
        tasks: nextTasks,
      });
      setMaterialItems(snapshot.materials.items);
      setTasks(snapshot.materials.tasks);
      setSavedMessage(copy.shared.saved);
      return true;
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
      return false;
    }
  };

  const addFollowupTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    const nextTasks: FollowupTask[] = [
      ...tasks,
      {
        title,
        reminderDate: taskReminderDate,
        status: 'pending',
      },
    ];
    if (await saveMaterials(nextTasks)) {
      setTaskTitle('');
    }
  };

  const generateSummary = async () => {
    try {
      const snapshot = await updateBusiness('summary', {
        regenerate: true,
      });
      setSummaryMetrics(snapshot.summary.metrics);
      setSummarySections(snapshot.summary.sections);
      setSavedMessage(copy.shared.saved);
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const renderLedger = () => (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-muted-foreground text-sm">
          {copy.ledger.action_hint}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setLedgerDraft(emptyLedgerEntry);
              setIsLedgerFormOpen((current) => !current);
            }}
          >
            <Plus className="size-4" />
            {copy.ledger.add_button}
          </Button>
          <input
            ref={ledgerImportInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleLedgerImport}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => ledgerImportInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {copy.ledger.import_button}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ledgerRows.length}
            onClick={handleLedgerExport}
          >
            <Download className="size-4" />
            {copy.ledger.export_button}
          </Button>
        </div>
      </div>

      {isLedgerFormOpen && (
        <form
          onSubmit={handleLedgerSubmit}
          className="bg-muted/20 rounded-2xl border p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">
              {ledgerDraft.id
                ? copy.ledger.edit_form_title
                : copy.ledger.form_title}
            </h3>
            <span className="text-muted-foreground text-xs">
              {copy.ledger.form_hint}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(
              [
                'name',
                'industry',
                'cashflow',
                'loan',
                'followup',
                'priority',
              ] as const
            ).map((field) => (
              <label key={field} className="space-y-1.5">
                <span className="text-muted-foreground text-xs">
                  {copy.ledger.form[field]}
                </span>
                <input
                  required={field === 'name' || field === 'industry'}
                  value={ledgerDraft[field]}
                  onChange={(event) =>
                    updateLedgerDraft(field, event.target.value)
                  }
                  placeholder={copy.ledger.form[field]}
                  className="border-input bg-background focus:ring-primary/30 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs">
                {copy.ledger.form.segment}
              </span>
              <select
                value={ledgerDraft.segment}
                onChange={(event) =>
                  updateLedgerDraft('segment', event.target.value)
                }
                className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
              >
                {copy.ledger.segment_options.map((option: any) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLedgerDraft(emptyLedgerEntry);
                setIsLedgerFormOpen(false);
              }}
            >
              {copy.ledger.cancel_button}
            </Button>
            <Button type="submit">
              {ledgerDraft.id
                ? copy.ledger.update_button
                : copy.ledger.save_button}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={ledgerQuery}
            onChange={(event) => setLedgerQuery(event.target.value)}
            placeholder={copy.ledger.search_placeholder}
            className="border-input bg-background focus:ring-primary/30 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {copy.ledger.filters.map((filter: any) => (
            <button
              type="button"
              key={filter.id}
              onClick={() => setLedgerFilter(filter.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                ledgerFilter === filter.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:border-primary/40'
              )}
            >
              {filter.title}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-muted/25 flex flex-col justify-between gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center">
        <div className="text-sm">
          {pendingCustomerName ? (
            <>
              <span className="text-muted-foreground">
                {copy.ledger.selected_label}
              </span>
              <span className="text-muted-foreground ml-2 font-mono">
                {getCustomerNumber(pendingCustomerId, pendingCustomerName)}
              </span>
              <span className="ml-2 font-semibold">{pendingCustomerName}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {copy.ledger.selection_hint}
            </span>
          )}
        </div>
        {pendingCustomerName ? (
          <Button type="button" size="sm" onClick={confirmCustomerSelection}>
            <Check className="size-4" />
            {copy.ledger.interview_button}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled>
            <Check className="size-4" />
            {copy.ledger.interview_button}
          </Button>
        )}
      </div>
      <div className="max-h-[620px] overflow-auto rounded-xl border">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 z-10 text-xs">
            <tr>
              <th className="w-16 px-4 py-3 text-center font-medium">
                {copy.ledger.select_column}
              </th>
              <th className="px-4 py-3 font-medium">
                {copy.ledger.customer_number}
              </th>
              {copy.ledger.columns.map((column: string) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">
                {copy.ledger.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ledgerRows.map((row, index) => {
              const rowName = normalizePersonName(row.name);
              const selected = row.id
                ? pendingCustomerId === row.id
                : pendingCustomerName === rowName;
              return (
                <tr
                  key={`${row.name}-${index}`}
                  onClick={() => {
                    setPendingCustomerId(row.id || '');
                    setPendingCustomerName(rowName);
                  }}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selected ? 'bg-primary/8' : 'hover:bg-muted/25'
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name="ledger-customer"
                      checked={selected}
                      onChange={() => {
                        setPendingCustomerId(row.id || '');
                        setPendingCustomerName(rowName);
                      }}
                      aria-label={`${copy.ledger.select_customer} ${rowName}`}
                      className="accent-primary size-4 cursor-pointer"
                    />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs font-medium tracking-wide">
                    {getCustomerNumber(row.id || '', row.name)}
                  </td>
                  <td className="px-4 py-3 font-medium">{rowName}</td>
                  <td className="px-4 py-3">{row.industry}</td>
                  <td className="px-4 py-3">{row.cashflow}</td>
                  <td className="px-4 py-3">{row.loan}</td>
                  <td className="px-4 py-3">{row.followup}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        disabled={row.canEdit === false}
                        title={
                          row.canEdit === false
                            ? copy.ledger.owner_only
                            : copy.ledger.edit_button
                        }
                        aria-label={`${copy.ledger.edit_button} ${rowName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          editLedgerCustomer(row);
                        }}
                        className="hover:bg-muted disabled:text-muted-foreground rounded-lg p-2 disabled:cursor-not-allowed"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={row.canEdit === false}
                        title={
                          row.canEdit === false
                            ? copy.ledger.owner_only
                            : copy.ledger.delete_button
                        }
                        aria-label={`${copy.ledger.delete_button} ${rowName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteLedgerCustomer(row);
                        }}
                        className="hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground rounded-lg p-2 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        {copy.ledger.result_label.replace('{count}', String(ledgerResultCount))}
      </p>
    </div>
  );

  const renderOcr = () => (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="bg-muted/20 rounded-2xl border border-dashed p-6 text-center">
        <SmartIcon
          name="ScanLine"
          className="text-primary mx-auto mb-4 size-10"
        />
        <h3 className="font-semibold">{copy.ocr.upload_title}</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {copy.ocr.upload_description}
        </p>
        <input
          ref={materialInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setSelectedMaterialName(file.name);
            setOcrReviewed(false);
          }}
        />
        <Button
          type="button"
          className="mt-5"
          onClick={() => materialInputRef.current?.click()}
        >
          {copy.ocr.select_button}
        </Button>
        <p className="text-muted-foreground mt-3 text-xs">
          {selectedMaterialName
            ? `${copy.ocr.selected_file}: ${selectedMaterialName}`
            : copy.ocr.file_hint}
        </p>
      </div>
      <div className="rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{copy.ocr.result_title}</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {ocrReviewed ? copy.ocr.reviewed : copy.ocr.pending}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ocrFields.map((field, index) => (
            <label key={field.label} className="space-y-1.5">
              <span className="text-muted-foreground text-xs">
                {field.label}
              </span>
              <input
                value={field.value}
                onChange={(event) => {
                  setOcrFields((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  );
                  setOcrReviewed(false);
                  setSavedMessage('');
                }}
                className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
              />
            </label>
          ))}
        </div>
        <Button
          className="mt-5"
          disabled={!selectedCustomerId || !businessCanEdit}
          onClick={() => void saveDocument()}
        >
          <ClipboardCheck className="size-4" />
          {copy.ocr.confirm_button}
        </Button>
      </div>
    </div>
  );

  const renderInterview = () => (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border p-5">
        <label className="font-semibold" htmlFor="interview-notes">
          {copy.interview.input_title}
        </label>
        <textarea
          id="interview-notes"
          value={interviewText}
          onChange={(event) => {
            setInterviewText(event.target.value);
            setInterviewReady(false);
          }}
          className="border-input bg-background min-h-64 w-full resize-none rounded-xl border p-4 text-sm leading-6"
        />
        <Button
          onClick={() => void saveInterview()}
          disabled={
            !interviewText.trim() || !selectedCustomerId || !businessCanEdit
          }
        >
          <Sparkles className="size-4" />
          {copy.interview.action}
        </Button>
      </div>
      <div className="rounded-2xl border bg-blue-50/40 p-5 dark:bg-blue-950/15">
        <h3 className="mb-4 font-semibold">{copy.interview.output_title}</h3>
        {interviewReady ? (
          <div className="space-y-3">
            {interviewOutputs.map((output) => (
              <div
                key={output.label}
                className="bg-background rounded-xl border p-4"
              >
                <div className="text-primary mb-1 text-xs font-semibold">
                  {output.label}
                </div>
                <p className="text-sm leading-6">{output.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
            {copy.interview.empty}
          </div>
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="mb-4 font-semibold">{copy.profile.form_title}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {profileFields.map((field, index) => (
            <label key={field.label} className="space-y-1.5">
              <span className="text-muted-foreground text-xs">
                {field.label}
              </span>
              <input
                value={field.value}
                onChange={(event) =>
                  setProfileFields((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
                className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
              />
            </label>
          ))}
        </div>
        <Button
          className="mt-5"
          disabled={!selectedCustomerId || !businessCanEdit}
          onClick={() => void saveProfile()}
        >
          <Check className="size-4" />
          {copy.shared.save}
        </Button>
      </div>
      <div className="dark:to-background rounded-2xl border bg-gradient-to-br from-blue-50 to-white p-5 dark:from-blue-950/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{copy.profile.summary_title}</h3>
          <span className="text-primary text-2xl font-bold">
            {profileCompleteness}%
          </span>
        </div>
        <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${profileCompleteness}%` }}
          />
        </div>
        <div className="mt-5 space-y-3">
          {profileTags.map((tag: string) => (
            <div key={tag} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600" />
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMatching = () => (
    <div className="space-y-5">
      <div className="bg-muted/20 flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">{copy.matching.customer_title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.matching.customer_summary}
          </p>
        </div>
        <Button
          disabled={!selectedCustomerId || !businessCanEdit}
          onClick={() => void recalculateMatching()}
        >
          <Sparkles className="size-4" />
          {copy.matching.action}
        </Button>
      </div>
      {matchReady && (
        <div className="grid gap-4 lg:grid-cols-2">
          {matchingProducts.map((product: any) => (
            <div key={product.title} className="rounded-2xl border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-primary text-xs font-semibold">
                    {product.label}
                  </span>
                  <h3 className="mt-1 font-semibold">{product.title}</h3>
                </div>
                <span className="text-primary text-2xl font-bold">
                  {product.score}
                </span>
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {product.reason}
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {product.condition}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {copy.matching.disclaimer}
      </p>
    </div>
  );

  const renderScripts = () => (
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.scripts.scenario_title}</h3>
        <div className="mt-4 space-y-2">
          {scripts.map((scenario, index) => (
            <button
              key={scenario.title}
              type="button"
              onClick={() => setScriptScenario(index)}
              className={cn(
                'w-full rounded-xl border p-3 text-left text-sm transition-colors',
                scriptScenario === index
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'hover:border-primary/40'
              )}
            >
              {scenario.title}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border bg-blue-50/35 p-5 dark:bg-blue-950/15">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{copy.scripts.output_title}</h3>
          <span className="text-muted-foreground text-xs">
            {copy.scripts.editable}
          </span>
        </div>
        <textarea
          value={scripts[scriptScenario]?.content || ''}
          onChange={(event) =>
            setScripts((current) =>
              current.map((script, index) =>
                index === scriptScenario
                  ? { ...script, content: event.target.value }
                  : script
              )
            )
          }
          className="border-input bg-background min-h-64 w-full resize-none rounded-xl border p-4 text-sm leading-7"
        />
        <Button
          className="mt-4"
          disabled={!selectedCustomerId || !businessCanEdit}
          onClick={() => void saveScript()}
        >
          <Check className="size-4" />
          {copy.scripts.confirm_button}
        </Button>
      </div>
    </div>
  );

  const renderMaterialChecklist = () => {
    const completeCount = materialChecked.size;
    const total = materialItems.length;
    const progress = Math.round((completeCount / total) * 100);
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border p-5">
          <h3 className="mb-4 font-semibold">{copy.materials.list_title}</h3>
          <div className="space-y-3">
            {materialItems.map((item, index) => {
              const checked = materialChecked.has(index);
              return (
                <label
                  key={item.title}
                  className="hover:border-primary/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(materialChecked);
                      if (checked) next.delete(index);
                      else next.add(index);
                      setMaterialChecked(next);
                    }}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {item.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="dark:to-background rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-5 dark:from-emerald-950/20">
          <h3 className="font-semibold">{copy.materials.progress_title}</h3>
          <div className="mt-5 text-5xl font-bold text-emerald-600">
            {progress}%
          </div>
          <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            {copy.materials.progress_text
              .replace('{complete}', String(completeCount))
              .replace('{total}', String(total))}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            disabled={!selectedCustomerId || !businessCanEdit}
            onClick={() => void saveMaterials()}
          >
            {copy.shared.save}
          </Button>
        </div>
      </div>
    );
  };

  const renderFollowup = () => (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.followup.add_title}</h3>
        <label className="mt-4 block space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {copy.followup.task_label}
          </span>
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder={copy.followup.task_placeholder}
            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="mt-4 block space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {copy.followup.date_label}
          </span>
          <input
            type="date"
            value={taskReminderDate}
            onChange={(event) => setTaskReminderDate(event.target.value)}
            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <Button
          className="mt-5"
          disabled={
            !taskTitle.trim() || !selectedCustomerId || !businessCanEdit
          }
          onClick={() => void addFollowupTask()}
        >
          <Plus className="size-4" />
          {copy.followup.add_button}
        </Button>
      </div>
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.followup.timeline_title}</h3>
        <div className="mt-5 space-y-4">
          {tasks.map((task, index) => (
            <div
              key={task.id || `${task.title}-${index}`}
              className="flex gap-3"
            >
              <div className="flex flex-col items-center">
                <span className="bg-primary mt-1 size-2.5 rounded-full" />
                {index < tasks.length - 1 && (
                  <span className="bg-border mt-1 h-full w-px" />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {copy.followup.task_meta}
                  {task.reminderDate ? ` · ${task.reminderDate}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMaterials = () => (
    <div className="space-y-6">
      {renderFollowup()}
      {renderMaterialChecklist()}
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {summaryMetrics.map((metric: any) => (
          <div
            key={metric.label}
            className="bg-muted/35 rounded-2xl border p-4"
          >
            <div className="text-primary text-2xl font-semibold">
              {metric.value}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {summarySections.map((item: any) => (
          <div key={item.title} className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <h3 className="font-semibold">{item.title}</h3>
            </div>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {item.content}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-blue-50/40 p-5 sm:flex-row sm:items-center dark:bg-blue-950/15">
        <div>
          <h3 className="font-semibold">{copy.summary.action_title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.summary.action_description}
          </p>
        </div>
        <Button
          disabled={!selectedCustomerId || !businessCanEdit}
          onClick={() => void generateSummary()}
        >
          <Sparkles className="size-4" />
          {copy.summary.action_button}
        </Button>
      </div>
    </div>
  );

  const renderActiveModule = () => {
    switch (activeId) {
      case 'ledger':
        return renderLedger();
      case 'ocr':
        return renderOcr();
      case 'interview':
        return renderInterview();
      case 'profile':
        return renderProfile();
      case 'matching':
        return renderMatching();
      case 'scripts':
        return renderScripts();
      case 'materials':
        return renderMaterials();
      case 'summary':
        return renderSummary();
      default:
        return null;
    }
  };

  return (
    <section className="bg-muted/15 min-h-screen pt-24 pb-16">
      <div className="container">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          {section.back_title}
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="text-primary mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
              {section.eyebrow}
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {section.title}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-3xl">
              {section.description}
            </p>
          </div>
          <div className="bg-background flex items-center gap-2 rounded-full border px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            {section.demo_notice}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="bg-background h-fit rounded-2xl border p-3 lg:sticky lg:top-24">
            <div className="text-muted-foreground px-3 py-2 text-xs font-medium">
              {section.module_label}
            </div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {modules.map((item) => {
                const className = cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  activeId === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                );
                const content = (
                  <>
                    <SmartIcon name={item.icon} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {item.title}
                    </span>
                    <ArrowRight className="size-3.5 opacity-60" />
                  </>
                );

                return item.url ? (
                  <Link
                    key={item.id}
                    href={getModuleHref(item.url)}
                    className={className}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => activateModule(item.id)}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="bg-background min-w-0 rounded-3xl border p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="mb-6 border-b pb-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <SmartIcon name={activeModule.icon} className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {activeModule.title}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {activeModule.description}
                  </p>
                </div>
              </div>
            </div>

            {activeId !== 'ledger' && selectedCustomerName && (
              <div className="border-primary/20 bg-primary/5 mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-muted-foreground">
                  {copy.shared.current_customer}
                </span>
                <span className="text-muted-foreground font-mono text-xs tracking-wide">
                  {getCustomerNumber(selectedCustomerId, selectedCustomerName)}
                </span>
                <span className="font-semibold">{selectedCustomerName}</span>
              </div>
            )}

            {renderActiveModule()}

            {savedMessage && (
              <div
                className={cn(
                  'mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
                  savedMessageIsError
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                )}
              >
                {savedMessageIsError ? (
                  <CircleAlert className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {savedMessage}
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
