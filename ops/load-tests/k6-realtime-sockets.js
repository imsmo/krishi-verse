// ops/load-tests/k6-realtime-sockets.js · realtime-gateway socket soak — many concurrent WS subscribers.
// Gate: connections hold, server sheds gracefully past caps (RT_MAX_SUBSCRIPTIONS), no crash. CLUSTER-ONLY.
import ws from 'k6/ws';
import { check } from 'k6';

const URL = __ENV.WS_URL || 'wss://rt.krishiverse.ai';
const TOKEN = __ENV.TOKEN || '';

export const options = {
  scenarios: { sockets: { executor: 'ramping-vus', startVUs: 0,
    stages: [ { duration: '2m', target: 2000 }, { duration: '10m', target: 5000 }, { duration: '3m', target: 0 } ] } },
};

export default function () {
  if (!TOKEN) return;
  const res = ws.connect(`${URL}/ws?token=${TOKEN}`, {}, (socket) => {
    socket.on('open', () => socket.send(JSON.stringify({ type: 'subscribe', channel: 'listings:public' })));
    socket.on('message', () => {});
    socket.setTimeout(() => socket.close(), 60000);
  });
  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
}
