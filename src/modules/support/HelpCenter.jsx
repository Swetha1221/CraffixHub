import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Wrench,
  UserCheck,
  Briefcase,
  Mail,
  HeartHandshake,
} from 'lucide-react';

const SUPPORT_AREAS = [
  {
    icon: MessageSquare,
    title: '1. General Inquiries',
    description:
      'Have questions about Craffix Web, our company, or our services? Contact us and our team will be happy to assist you.',
  },
  {
    icon: Wrench,
    title: '2. Technical Support',
    description:
      'Experiencing website errors, loading problems, login issues, or other technical difficulties? Let us know, and we will help you resolve them.',
  },
  {
    icon: UserCheck,
    title: '3. Account Assistance',
    description:
      'Need help with your account, registration, login credentials, or profile information? Contact our support team for assistance.',
  },
  {
    icon: Briefcase,
    title: '4. Service-Related Questions',
    description:
      'If you need information about our services, features, pricing, or project details, please reach out to us.',
  },
];

const FAQS = [
  {
    q: '1. What is Craffix Web?',
    a: 'Craffix Web is a company website providing information about its digital services and solutions.',
  },
  {
    q: '2. How can I contact Craffix Web?',
    a: 'You can contact us through our official contact page or support email.',
  },
  {
    q: '3. How can I get help with a technical issue?',
    a: 'Visit our Help & Support page and submit your issue with relevant details.',
  },
  {
    q: '4. How long does it take to receive a response?',
    a: 'We aim to respond to customer inquiries as soon as possible. Response times may vary depending on the nature of the request.',
  },
  {
    q: '5. Is my personal information safe?',
    a: 'We take reasonable steps to protect the personal information you share with us. Please read our Privacy Policy for more information.',
  },
  {
    q: '6. Can I update my personal information?',
    a: 'You may contact our support team to request updates or corrections to your personal information.',
  },
  {
    q: '7. What should I do if I experience a website error?',
    a: 'Try refreshing the page or accessing the website using another browser. If the issue continues, contact our support team.',
  },
  {
    q: '8. How can I report a problem?',
    a: 'Please contact us with a description of the problem and any relevant screenshots.',
  },
  {
    q: '9. Where can I find information about privacy?',
    a: 'You can find details about how we collect, use, and protect personal information on our Privacy Policy page.',
  },
  {
    q: '10. How can I provide feedback?',
    a: 'We welcome your suggestions and feedback. Please contact us through our official communication channels.',
  },
];

export function HelpCenter() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Help & Support</h1>
          <p className="page-subtitle">We&apos;re Here to Help!</p>
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          Welcome to Craffix Web Support. We are committed to providing a smooth and reliable experience for our customers. If you have questions, face technical difficulties, or need assistance with our services, our support team is here to help.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">How Can We Help You?</h3>
        </div>
        <div className="grid-2" style={{ gap: 14 }}>
          {SUPPORT_AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <div
                key={area.title}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span
                    className="kpi-icon-box"
                    style={{
                      width: 34,
                      height: 34,
                      background: 'var(--color-secondary-soft)',
                      color: 'var(--color-secondary)',
                    }}
                  >
                    <Icon size={17} />
                  </span>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{area.title}</div>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {area.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={18} color="var(--color-secondary)" /> How to Contact Support
            </h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            For assistance, please contact us through our official support email or contact form.
          </p>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>When contacting us, please include:</div>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <li>Your name.</li>
            <li>Your registered email address, if applicable.</li>
            <li>A clear description of your issue.</li>
            <li>Screenshots or relevant details, if necessary.</li>
          </ul>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Our team will review your request and respond as soon as possible.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HeartHandshake size={18} color="var(--color-secondary)" /> Our Commitment
            </h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            At Craffix Web, customer satisfaction is important to us. We aim to provide helpful guidance, timely responses, and a positive support experience.
          </p>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-secondary)' }}>
            Thank you for choosing Craffix Web!
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle size={18} color="var(--color-secondary)" /> Frequently Asked Questions
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={item.q} className="accordion-item">
                <button type="button" className="accordion-trigger" onClick={() => setOpenIdx(isOpen ? -1 : idx)}>
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isOpen && <div className="accordion-body">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
