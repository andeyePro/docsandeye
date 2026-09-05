import { describe, it, expect } from 'vitest';
import { buildMediaPlan, canonicalJson } from '../src/index.js';
import { loadProject } from '../src/index.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

// AC1: Core media plan — buildMediaPlan produces correct schema
describe('AC1: Media plan building', () => {
  it('buildMediaPlan exports videos from aep-like fixture', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    expect(plan.version).toBe(1);
    expect(plan.project_root).toBe('.');
    expect(plan.jobs.length).toBeGreaterThan(0);
  });

  it('buildMediaPlan sorts jobs by key', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    // Get all video media
    const videos = [...model.media.values()].filter(m => m.type === 'video');
    if (videos.length > 1) {
      const keys = plan.jobs.map(j => j.key);
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    }
  });

  it('buildMediaPlan includes poster_source from manifest poster field', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    for (const job of plan.jobs) {
      expect(job.poster_source).toBeDefined();
      expect(typeof job.poster_source).toBe('string');
      expect(job.poster_source.length).toBeGreaterThan(0);
    }
  });

  it('buildMediaPlan includes captions only when present in manifest', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    // Check that captions field is conditional
    for (const job of plan.jobs) {
      const media = model.media.get(job.key);
      if (media?.type === 'video' && media.captions) {
        expect(job.captions).toBeDefined();
        expect(job.outputs.captions).toBeDefined();
      } else if (media?.type === 'video') {
        expect(job.captions).toBeUndefined();
        expect(job.outputs.captions).toBeUndefined();
      }
    }
  });

  it('buildMediaPlan sets renditions to [720, 1080]', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    for (const job of plan.jobs) {
      expect(job.renditions).toEqual([720, 1080]);
    }
  });

  it('buildMediaPlan creates correct output paths', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    for (const job of plan.jobs) {
      expect(job.outputs.av1_720).toMatch(/^build\/media\/.*-720\.webm$/);
      expect(job.outputs.h264_720).toMatch(/^build\/media\/.*-720\.mp4$/);
      expect(job.outputs.av1_1080).toMatch(/^build\/media\/.*-1080\.webm$/);
      expect(job.outputs.h264_1080).toMatch(/^build\/media\/.*-1080\.mp4$/);
      expect(job.outputs.poster).toMatch(/^build\/media\/.*\.webp$/);
    }
  });

  it('buildMediaPlan skips non-video media', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    // Count videos in model
    const videoCount = [...model.media.values()].filter(m => m.type === 'video').length;
    expect(plan.jobs.length).toBeLessThanOrEqual(videoCount);
  });

  it('minimal fixture produces valid media plan', () => {
    const model = loadProject(join(fixturesDir, 'minimal'));
    const plan = buildMediaPlan(model);

    // Verify plan is structurally valid
    expect(plan.version).toBe(1);
    expect(typeof plan.project_root).toBe('string');
    expect(Array.isArray(plan.jobs)).toBe(true);

    // All jobs should have required fields
    for (const job of plan.jobs) {
      expect(job.key).toBeDefined();
      expect(job.media).toBeDefined();
      expect(job.source).toBeDefined();
      expect(job.poster_source).toBeDefined();
      expect(job.duration_s).toBeDefined();
      expect(job.renditions).toBeDefined();
      expect(job.outputs).toBeDefined();
    }
  });

  it('media plan produces canonical JSON', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);
    const json = canonicalJson(plan);

    // Should parse as valid JSON
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.jobs)).toBe(true);

    // Should produce consistent output (canonical)
    const json2 = canonicalJson(plan);
    expect(json2).toBe(json);
  });

  it('captions output name preserves language suffix', () => {
    const model = loadProject(join(fixturesDir, 'aep-like'));
    const plan = buildMediaPlan(model);

    for (const job of plan.jobs) {
      if (job.captions) {
        const captionsPath = job.outputs.captions;
        // Should preserve the language suffix from the input
        expect(captionsPath).toBeDefined();
        if (job.captions.includes('.en.')) {
          expect(captionsPath).toMatch(/\.en\./);
        }
      }
    }
  });
});
