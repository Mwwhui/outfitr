import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Hr,
  Preview,
} from 'react-email';

interface Props {
  userName: string;
  resetLink: string;
}

export default function PasswordReset({ userName, resetLink }: Props) {
  return (
    <Html>
      <Preview>Reset your Outfitr password</Preview>
      <Body
        style={{
          backgroundColor: '#f8fafc',
          padding: '40px 20px',
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '520px',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          }}
        >
          <Heading
            style={{
              color: '#0f172a',
              fontSize: '20px',
              fontWeight: 600,
              margin: '0 0 24px',
            }}
          >
            Reset your password
          </Heading>

          <Text style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 16px' }}>
            Hi {userName},
          </Text>

          <Text
            style={{
              color: '#475569',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: '0 0 24px',
            }}
          >
            We received a request to reset your Outfitr password. Click the
            button below to set a new password. This link expires in{' '}
            <strong>1 hour</strong>.
          </Text>

          <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
            <a
              href={resetLink}
              style={{
                display: 'inline-block',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: '10px',
                padding: '12px 28px',
              }}
            >
              Reset Password
            </a>
          </Section>

          <Text
            style={{
              color: '#64748b',
              fontSize: '13px',
              lineHeight: '1.5',
              margin: '0 0 24px',
            }}
          >
            If you didn&apos;t request this, you can safely ignore this email.
            Your password won&apos;t change unless you click the link above and
            create a new one.
          </Text>

          <Text
            style={{
              color: '#64748b',
              fontSize: '13px',
              lineHeight: '1.5',
              margin: '0 0 24px',
            }}
          >
            Link doesn&apos;t work? Copy and paste this into your browser:
            <br />
            <span
              style={{
                color: '#0f172a',
                fontSize: '12px',
                wordBreak: 'break-all',
              }}
            >
              {resetLink}
            </span>
          </Text>

          <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0' }} />

          <Text
            style={{
              color: '#94a3b8',
              fontSize: '12px',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Outfitr — Smart Wardrobe App
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
