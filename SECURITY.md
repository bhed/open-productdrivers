# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in ProductDrivers, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues by emailing:
- **Email**: security@productdrivers.com (or create a private security advisory on GitHub)

### What to Include

When reporting a vulnerability, please include:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact if exploited
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Affected Versions**: Which versions are affected
5. **Suggested Fix**: If you have one (optional)
6. **Your Contact Info**: So we can follow up with you

### What to Expect

- **Acknowledgment**: We'll acknowledge your report within 48 hours
- **Updates**: We'll keep you informed of our progress
- **Timeline**: We aim to fix critical vulnerabilities within 7 days
- **Credit**: We'll credit you in our security advisories (unless you prefer to remain anonymous)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

## Security Best Practices

### For Self-Hosters

1. **Environment Variables**:
   - Never commit `.env` files
   - Keep `SUPABASE_SERVICE_ROLE_KEY` secret
   - Rotate keys periodically

2. **Supabase Configuration**:
   - Enable RLS (Row Level Security) on all tables
   - Use the provided migration files
   - Keep Supabase updated

3. **Domain Restrictions**:
   - Configure allowed domains in project settings
   - Use this for web apps to prevent unauthorized usage

4. **HTTPS Only**:
   - Always use HTTPS in production
   - Never send API keys over HTTP

### For SDK Users

#### Web Apps
- Domain restrictions protect against unauthorized use
- PII detection can be enabled via `blockPII` option
- API keys can be safely exposed in frontend (protected by domain restrictions)

#### Mobile Apps
- **DO NOT** hardcode API keys in mobile apps
- **REQUIRED**: Implement a server-side proxy (see [MOBILE_SECURITY.md](MOBILE_SECURITY.md))
- Authenticate users through your backend
- Validate all data server-side

## Known Security Considerations

### API Key Exposure
- **Web Apps**: Project keys can be exposed in frontend (protected by domain restrictions)
- **Mobile Apps**: Project keys MUST be kept secret on your backend

### PII Detection
- Built-in PII detection is a helper, not a guarantee
- Always review data collection practices
- Implement additional safeguards as needed

### GDPR Compliance
- GDPR delete/export functions are provided
- You're responsible for compliance in your jurisdiction
- Audit your data collection practices

## Security Updates

We'll announce security updates via:
- GitHub Security Advisories
- Release notes
- Email (for reported vulnerabilities)

## Bug Bounty

We currently don't have a formal bug bounty program, but we greatly appreciate responsible disclosure and will:
- Credit you publicly (if desired)
- Prioritize your reports
- Consider financial rewards for critical findings on a case-by-case basis

## Scope

### In Scope
- ProductDrivers dashboard application
- All official SDKs (JavaScript, Flutter, Kotlin)
- Edge Functions
- Database migrations

### Out of Scope
- Third-party dependencies (report to their maintainers)
- Social engineering attacks
- Physical attacks
- DoS/DDoS attacks

## Hall of Fame

We'll maintain a list of security researchers who have responsibly disclosed vulnerabilities:

(No vulnerabilities reported yet)

---

Thank you for helping keep ProductDrivers and our community safe! 🔐

## Questions?

If you have questions about this policy, please open a [GitHub Discussion](https://github.com/bhed/open-productdrivers/discussions).
