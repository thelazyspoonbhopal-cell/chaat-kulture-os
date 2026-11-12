/**
 * CHAAT KULTURE OS — AUTHENTICATION & DEVICE SECURITY ENGINE
 * Provides WebCrypto SHA-256 password hashing, device fingerprinting,
 * mandatory geolocation verification, and single-session enforcement.
 */

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
}

export const authSecurity = {
  /**
   * Generates a cryptographic random salt string
   */
  generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Hashes a password with salt using native WebCrypto SHA-256
   */
  async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '::ck_salt::' + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Verifies an input password against stored hash & salt
   */
  async verifyPassword(password: string, storedHash?: string, salt?: string): Promise<boolean> {
    if (!storedHash || !salt) return false;
    const computed = await this.hashPassword(password, salt);
    return computed === storedHash;
  },

  /**
   * Generates a deterministic device fingerprint based on browser & hardware traits
   */
  async getDeviceFingerprint(): Promise<string> {
    try {
      const nav = window.navigator;
      const screen = window.screen;
      const raw = [
        nav.userAgent || '',
        nav.platform || '',
        nav.language || '',
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        nav.hardwareConcurrency || 'unknown',
      ].join('###');

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .slice(0, 16)
        .join('');
    } catch {
      return 'dev_' + Math.random().toString(36).substring(2, 10);
    }
  },

  /**
   * Detects human-friendly device and browser name
   */
  getDeviceName(): string {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows PC';
    else if (ua.includes('Mac')) os = 'macOS Device';
    else if (ua.includes('Android')) os = 'Android Device';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'Apple iOS Device';
    else if (ua.includes('Linux')) os = 'Linux Device';

    let browser = 'Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

    return `${os} (${browser})`;
  },

  /**
   * Captures GPS location with mandatory consent.
   * Rejects immediately if user denies permission.
   */
  async requestUserLocation(): Promise<GeoLocationResult> {
    if (!navigator.geolocation) {
      throw new Error('GEOLOCATION_UNSUPPORTED');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          const acc = Math.round(position.coords.accuracy);

          // Build descriptive coordinates label
          const latDir = lat >= 0 ? 'N' : 'S';
          const lngDir = lng >= 0 ? 'E' : 'W';
          const address = `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir} (Acc: ±${acc}m)`;

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            address,
          });
        },
        error => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(new Error('LOCATION_DENIED'));
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            reject(new Error('LOCATION_UNAVAILABLE'));
          } else if (error.code === error.TIMEOUT) {
            reject(new Error('LOCATION_TIMEOUT'));
          } else {
            reject(new Error('LOCATION_ERROR'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        }
      );
    });
  },
};
