# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers or use GitHub's private vulnerability reporting
3. Provide as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Best Practices

When deploying this application:

### Environment Variables

- **Never commit** `.env.local` or any file containing real credentials
- Use environment variables for all sensitive configuration
- In production, inject secrets via Kubernetes secrets or a secrets manager

### Database Security

- Use separate database users with minimal required permissions
- Enable SSL/TLS for database connections in production
- Regularly backup and rotate credentials

### Authentication

- In production, use `oauth-proxy` or `header` auth mode with a proper identity provider
- The `mock` auth mode is for development only
- The `direct` auth mode should only be used over HTTPS

### Network Security

- Always use HTTPS in production
- Place behind a reverse proxy (nginx, Traefik, etc.)
- Configure proper CORS headers

### SOAP Commands

- SOAP credentials should have minimal necessary permissions
- Consider disabling SOAP in production if not needed

## Security Features

This application includes:

- **SRP-6a Authentication**: Passwords are never stored in plain text
- **Session Management**: Secure session handling with configurable timeouts
- **GM Level Checks**: Administrative functions require proper GM levels
- **Input Validation**: All user inputs are validated and sanitized

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities.
