// apps/web-storefront/src/components/OrderTimeline.tsx · presentational order progress. Server component: maps the
// pure orderTimeline model to localized step labels. Off-path orders (cancelled / disputed) show a single status
// banner instead of a progress bar. The raw server status is always shown too (localized when known) so the UI
// never misrepresents the authoritative state.
import { getTranslator } from '../lib/i18n';
import { orderTimeline } from '../features/orders/timeline';

export function OrderTimeline({ status }: { status: string }) {
  const t = getTranslator();
  const model = orderTimeline(status);

  if (model.terminal) {
    return (
      <p className={`kv-timeline__terminal kv-timeline__terminal--${model.terminal}`} role="status">
        {t.t(`order.terminal.${model.terminal}`)}
      </p>
    );
  }

  return (
    <ol className="kv-timeline" aria-label={t.t('order.timelineLabel')}>
      {model.stepKeys.map((key, i) => {
        const state = i < model.currentIndex ? 'done' : i === model.currentIndex ? 'current' : 'todo';
        return (
          <li key={key} className={`kv-timeline__step kv-timeline__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="kv-timeline__dot" aria-hidden="true" />
            <span className="kv-timeline__label">{t.t(`order.step.${key}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
