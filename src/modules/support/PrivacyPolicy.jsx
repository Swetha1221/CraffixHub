import React from 'react';
import { ShieldCheck, Mail, Globe } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-subtitle">Effective Date: November 12, 2026</p>
        </div>
        <span className="badge badge-primary">
          <ShieldCheck size={13} /> Craffix Web
        </span>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">1. Introduction</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0 }}>Welcome to Craffix Web.</p>
          <p style={{ margin: 0 }}>
            At Craffix Web, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect information when you visit our website or use our services.
          </p>
          <p style={{ margin: 0 }}>
            By accessing our website, you acknowledge that you have read this Privacy Policy.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">2. Information We Collect</h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            We may collect the following types of information:
          </p>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Personal Information</div>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <li>Name</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Contact details</li>
            <li>Information you voluntarily submit through forms</li>
          </ul>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Technical Information</div>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Device information</li>
            <li>Operating system</li>
            <li>Website usage information</li>
          </ul>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Communication Information</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            We may collect information you provide when contacting our support team, submitting inquiries, or providing feedback.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">3. How We Use Your Information</h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            We may use collected information to:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)' }}>
            <li>Provide and improve our services.</li>
            <li>Respond to customer inquiries.</li>
            <li>Provide technical support.</li>
            <li>Communicate important updates.</li>
            <li>Maintain website security.</li>
            <li>Improve website performance and user experience.</li>
            <li>Prevent fraudulent or unauthorized activities.</li>
            <li>Comply with applicable legal obligations.</li>
          </ul>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">4. Cookies and Tracking Technologies</h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Our website may use cookies and similar technologies to improve website functionality and user experience. Cookies may help us:
          </p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            <li>Remember user preferences.</li>
            <li>Understand website traffic.</li>
            <li>Improve website performance.</li>
            <li>Analyze how visitors interact with our website.</li>
          </ul>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            You can manage or disable cookies through your browser settings. Some website features may not work properly if cookies are disabled.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">5. Sharing of Information</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>Craffix Web does not sell personal information to third parties.</p>
            <p style={{ margin: 0 }}>
              We may share information with trusted service providers when necessary to operate our website, provide services, maintain security, or comply with legal requirements.
            </p>
            <p style={{ margin: 0 }}>
              Such service providers should only process information as necessary for their assigned purposes.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">6. Data Security</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              We take reasonable technical and organizational measures to protect personal information against unauthorized access, misuse, alteration, disclosure, or loss.
            </p>
            <p style={{ margin: 0 }}>
              However, no method of online transmission or electronic storage is completely secure. Therefore, we cannot guarantee absolute security.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">7. Data Retention</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            We retain personal information only for as long as necessary to fulfill the purposes described in this Privacy Policy, meet legal requirements, resolve disputes, and enforce agreements.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">8. Your Privacy Rights</h3>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Depending on applicable laws, you may have the right to:
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            <li>Request access to your personal information.</li>
            <li>Request corrections to inaccurate information.</li>
            <li>Request deletion of your personal information.</li>
            <li>Withdraw consent where processing is based on consent.</li>
            <li>Object to certain types of data processing.</li>
            <li>Raise a privacy-related complaint.</li>
          </ul>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            To exercise these rights, please contact us.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">9. Third-Party Links</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            Our website may contain links to third-party websites or services. Craffix Web is not responsible for the privacy practices, content, or security of external websites. We encourage users to review the privacy policies of those websites.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">10. Children&apos;s Privacy</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              Our website is not intended to knowingly collect personal information from children without appropriate consent where required by law.
            </p>
            <p style={{ margin: 0 }}>
              If we become aware that personal information has been collected improperly from a child, we will take appropriate steps to address the situation.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">11. Changes to This Privacy Policy</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              We may update this Privacy Policy from time to time to reflect changes in our services, business practices, or legal requirements.
            </p>
            <p style={{ margin: 0 }}>
              Any updates will be published on this page with a revised effective date.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={17} color="var(--color-secondary)" /> 12. Contact Us
          </h3>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
          <div><strong>Company:</strong> Craffix Web</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} color="var(--color-secondary)" />
            <span><strong>Email:</strong> manoj@craffixweb.com</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} color="var(--color-secondary)" />
            <span>
              <strong>Website:</strong>{' '}
              <a href="https://craffixweb.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                https://craffixweb.com/
              </a>
            </span>
          </div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)' }}>
          We appreciate your trust in Craffix Web.
        </p>
      </div>
    </div>
  );
}
