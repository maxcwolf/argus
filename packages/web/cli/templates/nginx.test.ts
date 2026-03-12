import { describe, it, expect } from 'vitest'
import { generateNginxConf } from './nginx'

describe('generateNginxConf', () => {
  it('generates HTTP-only config', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'none' })
    expect(conf).toContain('listen 80;')
    expect(conf).toContain('server_name argus.example.com;')
    expect(conf).toContain('proxy_pass http://web:3000;')
    expect(conf).not.toContain('listen 443')
    expect(conf).not.toContain('ssl_certificate')
  })

  it('generates Let\'s Encrypt config with HTTP redirect and ACME challenge', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'letsencrypt' })

    // HTTP redirect block
    expect(conf).toContain('return 301 https://$server_name$request_uri;')

    // ACME challenge
    expect(conf).toContain('/.well-known/acme-challenge/')
    expect(conf).toContain('/var/www/certbot')

    // HTTPS block
    expect(conf).toContain('listen 443 ssl http2;')
    expect(conf).toContain(`ssl_certificate /etc/letsencrypt/live/argus.example.com/fullchain.pem;`)
    expect(conf).toContain(`ssl_certificate_key /etc/letsencrypt/live/argus.example.com/privkey.pem;`)

    // Proxy
    expect(conf).toContain('proxy_pass http://web:3000;')
  })

  it('generates custom certificate config', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'custom' })

    // HTTP redirect
    expect(conf).toContain('return 301 https://$server_name$request_uri;')

    // No ACME challenge
    expect(conf).not.toContain('acme-challenge')

    // Custom cert paths
    expect(conf).toContain('ssl_certificate /etc/nginx/certs/fullchain.pem;')
    expect(conf).toContain('ssl_certificate_key /etc/nginx/certs/privkey.pem;')
  })

  it('includes SSL protocol settings for HTTPS configs', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'letsencrypt' })
    expect(conf).toContain('ssl_protocols TLSv1.2 TLSv1.3;')
  })

  it('includes proxy headers for forwarding', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'none' })
    expect(conf).toContain('X-Real-IP')
    expect(conf).toContain('X-Forwarded-For')
    expect(conf).toContain('X-Forwarded-Proto')
  })

  it('sets client_max_body_size', () => {
    const conf = generateNginxConf({ domain: 'argus.example.com', https: 'none' })
    expect(conf).toContain('client_max_body_size 50M;')
  })
})
