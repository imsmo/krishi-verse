// core/auth/__tests__/sms-provider.spec.ts
// Proves the SMS adapters: MSG91 sends OUR code to the DLT OTP endpoint, throws on provider failure, and NEVER
// logs the code; the port's sendOtp default delegates to send(); mobile normalisation is correct.
import { Msg91SmsSender, toMsg91Mobile } from '../sms.msg91';
import { TwilioSmsSender } from '../sms.twilio';
import { SmsSender, SmsOtpContext } from '../otp.service';

// a ResilienceService stub that just runs the fn (no timers/breaker needed for the unit assertion)
const resilience = { run: (_dep: string, fn: () => Promise<unknown>) => fn(), configure: () => {} } as any;

const ctx: SmsOtpContext = { code: '482913', ttlMin: 5, purpose: 'login', locale: 'en' };

describe('toMsg91Mobile', () => {
  it('strips +, spaces and dashes', () => {
    expect(toMsg91Mobile('+91 98123-45678')).toBe('919812345678');
  });
});

describe('Msg91SmsSender.sendOtp', () => {
  const cfg = { authKey: 'AK', senderId: 'KRSHVR', otpTemplateId: 'TPL1', baseUrl: 'https://control.msg91.com' };
  afterEach(() => { (global.fetch as any) = undefined; });

  it('POSTs OUR code to the v5 OTP endpoint with authkey + template, no leading + on mobile', async () => {
    let captured: { url: string; init: any } | null = null;
    global.fetch = (async (url: string, init: any) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ type: 'success' }) };
    }) as any;

    await new Msg91SmsSender(cfg, resilience).sendOtp('+919812345678', ctx, 'ignored rendered text');

    expect(captured!.url).toBe('https://control.msg91.com/api/v5/otp');
    expect(captured!.init.headers.authkey).toBe('AK');
    const body = JSON.parse(captured!.init.body);
    expect(body).toMatchObject({ template_id: 'TPL1', sender: 'KRSHVR', mobile: '919812345678', otp: '482913' });
  });

  it('throws when the provider returns type:error (so the user can retry; no false "sent")', async () => {
    global.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ type: 'error', message: 'bad template' }) })) as any;
    await expect(new Msg91SmsSender(cfg, resilience).sendOtp('+919812345678', ctx, 'x')).rejects.toThrow(/msg91 otp send failed/);
  });

  it('throws on non-2xx', async () => {
    global.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as any;
    await expect(new Msg91SmsSender(cfg, resilience).sendOtp('+919812345678', ctx, 'x')).rejects.toThrow(/503/);
  });

  it('NEVER logs the OTP code', async () => {
    const logged: string[] = [];
    const sink = jest.spyOn(require('@nestjs/common').Logger.prototype, 'debug').mockImplementation((...a: unknown[]) => { logged.push(String(a[0])); });
    global.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ type: 'success' }) })) as any;
    await new Msg91SmsSender(cfg, resilience).sendOtp('+919812345678', ctx, 'rendered 482913 text');
    expect(logged.join(' ')).not.toContain('482913');
    expect(logged.join(' ')).not.toContain('919812345678');
    sink.mockRestore();
  });

  it('raw send() is rejected (DLT forbids free-text)', async () => {
    await expect(new Msg91SmsSender(cfg, resilience).send('+919812345678', 'hello')).rejects.toThrow(/not DLT-permitted/);
  });
});

describe('TwilioSmsSender', () => {
  const cfg = { accountSid: 'ACxx', authToken: 'tok', from: '+15005550006' };
  afterEach(() => { (global.fetch as any) = undefined; });

  it('default sendOtp delegates to send() with the rendered message + Basic auth', async () => {
    let captured: any = null;
    global.fetch = (async (url: string, init: any) => { captured = { url, init }; return { ok: true, status: 201, json: async () => ({}) }; }) as any;
    await new TwilioSmsSender(cfg, resilience).sendOtp('+919812345678', ctx, 'Your code is 482913');
    expect(captured.url).toContain('/Accounts/ACxx/Messages.json');
    expect(captured.init.headers.authorization).toMatch(/^Basic /);
    expect(String(captured.init.body)).toContain('Your+code+is+482913'); // url-encoded body carries the message
  });

  it('uses MessagingServiceSid when from starts with MG', async () => {
    let body = '';
    global.fetch = (async (_url: string, init: any) => { body = String(init.body); return { ok: true, status: 201, json: async () => ({}) }; }) as any;
    await new TwilioSmsSender({ ...cfg, from: 'MG123' }, resilience).send('+919812345678', 'hi');
    expect(body).toContain('MessagingServiceSid=MG123');
  });
});

describe('SmsSender.sendOtp default', () => {
  it('delegates to send() with the rendered message', async () => {
    const sent: Array<[string, string]> = [];
    class Fake extends SmsSender { async send(p: string, m: string) { sent.push([p, m]); } }
    await new Fake().sendOtp('+91999', ctx, 'rendered msg');
    expect(sent).toEqual([['+91999', 'rendered msg']]);
  });
});
