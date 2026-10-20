import { PiWebApiSimulator } from '../pi-web-api-simulator';
import { SimFrame } from '../sim-model';
import { SimValue } from '../sim-streams';
import { lossFrame, outputFrame, round } from './sample-frames';
import {
  LOSS_SCENARIOS,
  LossScenario,
  NOMINAL_RATE_TPH,
  SAMPLE_STREAMS,
  sampleElement,
} from './sample-plant';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** loss slots repeat every 5 h from this anchor, so the history is the same on every start */
const ANCHOR = Date.UTC(2026, 0, 1, 1, 0);
const LOSS_EVERY = 5 * HOUR;
/** shift starts in UTC (06:00, 14:00, 22:00 Asia/Tehran) */
const SHIFT_STARTS_UTC_MINUTES = [150, 630, 1110];
const STREAM_STEP = 5 * MINUTE;

/** A live loss frame the feed opened and will close on a later tick. */
interface OpenLoss {
  scenario: LossScenario;
  start: Date;
  closeAt: Date;
}

/**
 * Feeds the simulator like a running plant: `seedHistory` writes `days` of closed loss frames (every
 * fifth on the extruder's main drive, one pelletizer stop a day), shift output frames and 5-minute
 * throughput / melt temperature values; `tick` advances live — opens a loss frame (open sentinel),
 * closes it when its scenario duration has passed, books the finished shift's output and appends
 * stream values. Deterministic: the scenario of each slot comes from its position, never randomness.
 */
export class SampleFeed {
  private open: OpenLoss | null = null;
  private liveSlot = 0;
  private lastStreamAt = 0;
  private lastShiftBooked = 0;

  constructor(
    private readonly sim: PiWebApiSimulator,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  seedHistory(days: number): { frames: number; values: number } {
    const end = this.floorTo(this.clock().getTime(), STREAM_STEP);
    const start = end - days * 24 * HOUR;
    const losses = this.historicLosses(start, end - HOUR);
    this.sim.addFrames(losses);
    const outputs = this.outputs(start, end, losses);
    this.sim.addFrames(outputs);
    const values = this.streamValues(start, end);
    this.lastStreamAt = end;
    this.lastShiftBooked = this.lastShiftStart(end);
    return { frames: losses.length + outputs.length, values };
  }

  /** One live step; returns what changed for the console log. */
  tick(): string[] {
    const now = this.clock();
    const changes: string[] = [];
    if (this.open && now >= this.open.closeAt)
      changes.push(this.closeLive(now));
    else if (!this.open) changes.push(this.openLive(now));
    const shift = this.lastShiftStart(now.getTime());
    if (shift > this.lastShiftBooked) {
      this.sim.addFrames(
        this.outputs(this.lastShiftBooked, shift, [
          ...this.sim.frames.values(),
        ]),
      );
      changes.push(
        `booked output of the shift ending ${new Date(shift).toISOString()}`,
      );
      this.lastShiftBooked = shift;
    }
    const added = this.streamValues(
      this.lastStreamAt + STREAM_STEP,
      now.getTime(),
    );
    if (added > 0) this.lastStreamAt = this.floorTo(now.getTime(), STREAM_STEP);
    return changes;
  }

  private openLive(now: Date): string {
    const scenario = LOSS_SCENARIOS[this.liveSlot % LOSS_SCENARIOS.length];
    this.liveSlot += 1;
    // live frames last a tenth of the scenario (at least two minutes) so a demo sees them close
    const minutes = Math.max(2, scenario.minutes / 10);
    this.open = {
      scenario,
      start: now,
      closeAt: new Date(now.getTime() + minutes * MINUTE),
    };
    const frame = lossFrame({
      scenario,
      element: sampleElement('extruder'),
      start: now,
      end: null,
    });
    this.sim.addFrames([frame]);
    return `opened ${frame.WebId} (${scenario.reason}, still running)`;
  }

  private closeLive(now: Date): string {
    const open = this.open as OpenLoss;
    const frame = lossFrame({
      scenario: open.scenario,
      element: sampleElement('extruder'),
      start: open.start,
      end: now,
    });
    this.sim.addFrames([frame]);
    this.open = null;
    return `closed ${frame.WebId} (${open.scenario.reason})`;
  }

  private historicLosses(start: number, end: number): SimFrame[] {
    const frames: SimFrame[] = [];
    const first = Math.ceil((start - ANCHOR) / LOSS_EVERY);
    for (let slot = first; ANCHOR + slot * LOSS_EVERY < end; slot++) {
      const at = new Date(ANCHOR + slot * LOSS_EVERY);
      const scenario =
        LOSS_SCENARIOS[
          ((slot % LOSS_SCENARIOS.length) + LOSS_SCENARIOS.length) %
            LOSS_SCENARIOS.length
        ];
      const closed = new Date(at.getTime() + scenario.minutes * MINUTE);
      if (closed.getTime() > end) break;
      const element = sampleElement(slot % 5 === 0 ? 'drive' : 'extruder');
      frames.push(lossFrame({ scenario, element, start: at, end: closed }));
      if (slot % 5 === 2)
        frames.push(this.pelletizerStop(new Date(at.getTime() + 2 * HOUR)));
    }
    return frames;
  }

  private pelletizerStop(at: Date): SimFrame {
    const scenario = LOSS_SCENARIOS[1];
    return lossFrame({
      scenario,
      element: sampleElement('pelletizer'),
      start: at,
      end: new Date(at.getTime() + 15 * MINUTE),
    });
  }

  /** Output frames of every full shift in `[start, end)`; losses inside the shift reduce good tonnes. */
  private outputs(
    start: number,
    end: number,
    losses: readonly SimFrame[],
  ): SimFrame[] {
    const frames: SimFrame[] = [];
    for (
      let shift = this.nextShiftStart(start);
      shift + 8 * HOUR <= end;
      shift += 8 * HOUR
    ) {
      const lost = losses
        .filter(
          (frame) =>
            frame.TemplateName === 'Production Loss' &&
            frame.PrimaryReferencedElement?.WebId !==
              sampleElement('pelletizer').webId,
        )
        .filter(
          (frame) =>
            Date.parse(frame.StartTime) >= shift &&
            Date.parse(frame.StartTime) < shift + 8 * HOUR,
        )
        .reduce((sum, frame) => sum + quantityOf(frame), 0);
      const index = Math.floor(shift / (8 * HOUR));
      frames.push(
        outputFrame({
          element: sampleElement('extruder'),
          start: new Date(shift),
          end: new Date(shift + 8 * HOUR),
          goodTonnes: Math.max(0, 8 * NOMINAL_RATE_TPH - lost - 0.6),
          scrapTonnes: 0.4 + (index % 3) * 0.1,
        }),
      );
    }
    return frames;
  }

  /** Throughput and melt temperature every 5 minutes in `[from, to]`; returns the values added. */
  private streamValues(from: number, to: number): number {
    const throughput: SimValue[] = [];
    const melt: SimValue[] = [];
    const losses = [...this.sim.frames.values()].filter(
      (frame) =>
        frame.TemplateName === 'Production Loss' &&
        frame.PrimaryReferencedElement?.WebId !==
          sampleElement('pelletizer').webId,
    );
    for (
      let at = this.floorTo(from, STREAM_STEP);
      at <= to;
      at += STREAM_STEP
    ) {
      const step = Math.floor(at / STREAM_STEP);
      const share = lossShareAt(losses, at);
      const rate =
        share > 0
          ? NOMINAL_RATE_TPH * (1 - share)
          : NOMINAL_RATE_TPH + ((step % 7) - 3) * 0.08;
      const timestamp = new Date(at).toISOString();
      throughput.push({
        Timestamp: timestamp,
        Value: round(rate, 3),
        UnitsAbbreviation: SAMPLE_STREAMS.throughput.unit,
        Good: true,
      });
      melt.push({
        Timestamp: timestamp,
        Value: round(share >= 1 ? 190 : 215 + ((step % 5) - 2) * 0.4, 1),
        UnitsAbbreviation: SAMPLE_STREAMS.meltTemp.unit,
        Good: true,
      });
    }
    if (throughput.length === 0) return 0;
    this.sim.streams.add(SAMPLE_STREAMS.throughput.webId, throughput);
    this.sim.streams.add(SAMPLE_STREAMS.meltTemp.webId, melt);
    return throughput.length;
  }

  private nextShiftStart(at: number): number {
    const day = this.floorTo(at, 24 * HOUR);
    for (let offset = 0; offset < 2; offset++) {
      for (const minutes of SHIFT_STARTS_UTC_MINUTES) {
        const start = day + offset * 24 * HOUR + minutes * MINUTE;
        if (start >= at) return start;
      }
    }
    return day + 24 * HOUR;
  }

  /** Start of the latest shift that began at or before `at`. */
  private lastShiftStart(at: number): number {
    return this.nextShiftStart(at - 8 * HOUR + 1);
  }

  private floorTo(value: number, step: number): number {
    return Math.floor(value / step) * step;
  }
}

function quantityOf(frame: SimFrame): number {
  const quantity = frame.attributes.Quantity as { Value?: unknown } | undefined;
  return typeof quantity?.Value === 'number' ? quantity.Value : 0;
}

/** Share of the rate lost at `at` by the loss frame running then (0 when none). */
function lossShareAt(losses: readonly SimFrame[], at: number): number {
  const running = losses.find((frame) => {
    const start = Date.parse(frame.StartTime);
    const end = frame.EndTime.startsWith('9999')
      ? Infinity
      : Date.parse(frame.EndTime);
    return start <= at && at < end;
  });
  if (!running) return 0;
  const reason = (
    running.attributes.ReasonCode as { Name?: string } | undefined
  )?.Name;
  return (
    LOSS_SCENARIOS.find((scenario) => scenario.reason === reason)?.lossShare ??
    1
  );
}
