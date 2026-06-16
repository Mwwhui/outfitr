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

interface PledgeItem {
  name: string;
  brand: string | null;
}

interface Props {
  userName: string;
  partnerName: string;
  partnerType: 'donate' | 'sell' | 'recycle';
  items: PledgeItem[];
  pledgeId: string;
}

// Mapped exactly to Tailwind's 100 (bg), 200 (border), and 800 (text) values
const themeColors = {
  donate: {
    bg: '#fef3c7', // amber-100
    border: '#fde68a', // amber-200
    text: '#92400e', // amber-800
    label: 'Donate',
  },
  sell: {
    bg: '#dbeafe', // blue-100
    border: '#bfdbfe', // blue-200
    text: '#1e40af', // blue-800
    label: 'Sell / Trade',
  },
  recycle: {
    bg: '#dcfce3', // green-100
    border: '#bbf7d0', // green-200
    text: '#166534', // green-800
    label: 'Recycle',
  },
};

export default function PledgeConfirmation({
  userName,
  partnerName,
  partnerType,
  items,
  pledgeId,
}: Props) {
  const theme = themeColors[partnerType];

  return (
    <Html>
      <Preview>Your {partnerType} request has been submitted</Preview>
      <Body
        style={{
          backgroundColor: '#f8fafc',
          padding: '40px 20px',
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Main Card */}
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
            Request Submitted
          </Heading>

          <Text
            style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 16px' }}
          >
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
            Your request to send the following items to{' '}
            <strong style={{ color: '#0f172a' }}>{partnerName}</strong> has been
            received and is pending review.
          </Text>

          {/* Type Badge */}
          <Section style={{ marginBottom: '16px' }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {theme.label}
            </span>
          </Section>

          {/* Items List */}
          <Section style={{ marginBottom: '24px' }}>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <Text
                  style={{
                    margin: '0 0 4px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  {item.name}
                </Text>
                <Text style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Brand: {item.brand || '—'}
                </Text>
              </div>
            ))}
          </Section>

          {/* Reference Info */}
          <Section
            style={{
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: '12px',
                margin: '0 0 4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Reference ID
            </Text>
            <Text
              style={{
                color: '#0f172a',
                fontSize: '20px',
                fontWeight: 700,
                margin: 0,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              #{pledgeId.slice(0, 8)}
            </Text>
          </Section>

          <Text
            style={{
              color: '#475569',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: '0 0 24px',
            }}
          >
            <strong style={{ color: '#0f172a' }}>What&apos;s next?</strong> The
            partner will review your request and reach out. You can track this
            in your Outfitr dashboard.
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
