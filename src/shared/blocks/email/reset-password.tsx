import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export function ResetPasswordEmail({
  appName = 'FinReach',
  url,
}: {
  appName?: string;
  url: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Reset your ${appName} password`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Heading style={styles.heading}>重置登录密码</Heading>
            <Text style={styles.text}>
              我们收到了你的密码重置请求。点击下方按钮设置新密码，该链接将在一小时后失效。
            </Text>
            <Button href={url} style={styles.button}>
              重置密码
            </Button>
            <Text style={styles.muted}>
              如果不是你本人发起的请求，请忽略这封邮件，你的密码不会发生变化。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0,
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    color: '#0f172a',
  },
  container: { maxWidth: 560, margin: '0 auto', padding: '32px 16px' },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: 16,
    padding: 28,
  },
  heading: { margin: '0 0 12px', fontSize: 24 },
  text: { color: '#334155', fontSize: 14, lineHeight: '22px' },
  button: {
    display: 'inline-block',
    margin: '14px 0',
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    padding: '12px 18px',
    textDecoration: 'none',
  },
  muted: { color: '#64748b', fontSize: 12, lineHeight: '18px' },
};
