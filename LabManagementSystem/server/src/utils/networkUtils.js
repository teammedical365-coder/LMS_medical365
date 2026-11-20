/**
 * Lab Management System (LMS) - Network & LAN Host Security Utilities
 * 
 * Provides fail-closed RFC 1918 private IPv4 subnet and loopback validation.
 * Strictly separates trusted private local networks from untrusted public WAN hosts.
 */

/**
 * Determines whether a hostname or IP address is a private LAN, internal Docker, or loopback host (RFC 1918).
 * Strictly rejects public WAN IPs, internet domain names, and malformed hosts.
 * 
 * Allowed in Local Edition:
 * - Loopback: 'localhost', '127.0.0.1', '::1', 127.0.0.0/8
 * - Docker internal service names: 'mongo', 'backend', 'frontend'
 * - RFC 1918 Class A: 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - RFC 1918 Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - RFC 1918 Class C: 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * 
 * Strictly Rejected:
 * - Public internet domains: 'google.com', 'lms-medical365.vercel.app', 'onrender.com', 'evil.com'
 * - Public WAN IPs: '8.8.8.8', '1.1.1.1', '104.21.5.1', etc.
 * - Out of range IPs: '256.0.0.1', '172.32.0.1', etc.
 */
export function isPrivateLanHost(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') return false;

  let clean = rawHost.trim().toLowerCase();
  clean = clean.replace(/^[a-z]+:\/\//, ''); // strip protocol
  clean = clean.split('/')[0];               // strip path

  // Handle bracketed IPv6 e.g. [::1]:80 or [::1]
  if (clean.startsWith('[')) {
    clean = clean.replace(/^\[(.*?)\](:\d+)?$/, '$1');
  } else if (clean.includes(':') && (clean.match(/:/g) || []).length === 1) {
    // Only strip port if it is host:port (single colon)
    clean = clean.split(':')[0];
  }
  clean = clean.replace(/\.$/, '');          // strip trailing dot

  if (!clean) return false;

  // 1. Loopback addresses and Docker service hostnames
  if (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'mongo' ||
    clean === 'backend' ||
    clean === 'frontend'
  ) {
    return true;
  }

  // 2. IPv4 address validation and RFC 1918 private subnet checks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = clean.match(ipv4Regex);
  if (match) {
    const [, s1, s2, s3, s4] = match;
    const o1 = parseInt(s1, 10);
    const o2 = parseInt(s2, 10);
    const o3 = parseInt(s3, 10);
    const o4 = parseInt(s4, 10);

    // Validate octet ranges (0-255)
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return false;

    // Loopback: 127.0.0.0/8
    if (o1 === 127) return true;

    // Class A Private: 10.0.0.0/8
    if (o1 === 10) return true;

    // Class B Private: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;

    // Class C Private: 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
    if (o1 === 192 && o2 === 168) return true;

    // Reject all public WAN IPv4 addresses
    return false;
  }

  // Reject public WAN hostnames/domains
  return false;
}

export default {
  isPrivateLanHost,
};
