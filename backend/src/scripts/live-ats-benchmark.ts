import { performance } from 'perf_hooks';

interface BenchmarkResult {
  atsType: string;
  boardSlug: string;
  url: string;
  statusCode: number;
  rttMs: number;
  etag: string | null;
  lastModified: string | null;
  supports304: boolean;
  conditional304RttMs?: number;
  itemCount: number;
  notes: string;
}

async function benchmarkAts(
  atsType: string,
  boardSlug: string,
  url: string,
  extractCount: (data: any) => number
): Promise<BenchmarkResult> {
  // 1. Initial GET
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ResumeHack-LatencyBenchmark/1.0',
      },
    });
  } catch (err: any) {
    return {
      atsType,
      boardSlug,
      url,
      statusCode: 0,
      rttMs: 0,
      etag: null,
      lastModified: null,
      supports304: false,
      itemCount: 0,
      notes: `Network error: ${err.message}`,
    };
  }
  const t1 = performance.now();
  const rttMs = Math.round(t1 - t0);

  const etag = res.headers.get('etag') || res.headers.get('ETag');
  const lastModified = res.headers.get('last-modified') || res.headers.get('Last-Modified');

  let data: any = null;
  let itemCount = 0;
  if (res.ok) {
    try {
      data = await res.json();
      itemCount = extractCount(data);
    } catch {}
  }

  // 2. Conditional GET with If-None-Match / If-Modified-Since
  let supports304 = false;
  let conditional304RttMs: number | undefined;

  if (etag || lastModified) {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'ResumeHack-LatencyBenchmark/1.0',
    };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const t2 = performance.now();
    try {
      const condRes = await fetch(url, { headers });
      const t3 = performance.now();
      conditional304RttMs = Math.round(t3 - t2);
      supports304 = condRes.status === 304;
    } catch {}
  }

  return {
    atsType,
    boardSlug,
    url,
    statusCode: res.status,
    rttMs,
    etag,
    lastModified,
    supports304,
    conditional304RttMs,
    itemCount,
    notes: supports304
      ? `304 verified (RTT: ${conditional304RttMs}ms)`
      : etag
      ? 'ETag present but returns 200 on conditional GET'
      : 'No ETag returned',
  };
}

async function runLiveBenchmarks() {
  console.log('========================================================================');
  console.log('  STARTING REAL-WORLD LIVE ATS ENDPOINT LATENCY & CONDITIONAL-GET AUDIT');
  console.log('========================================================================\n');

  const targets = [
    {
      atsType: 'Greenhouse',
      boardSlug: 'stripe',
      url: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true',
      extractCount: (d: any) => d?.jobs?.length || 0,
    },
    {
      atsType: 'Greenhouse',
      boardSlug: 'cloudflare',
      url: 'https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs?content=true',
      extractCount: (d: any) => d?.jobs?.length || 0,
    },
    {
      atsType: 'Lever',
      boardSlug: 'figma',
      url: 'https://api.lever.co/v0/postings/figma?mode=json',
      extractCount: (d: any) => (Array.isArray(d) ? d.length : 0),
    },
    {
      atsType: 'Lever',
      boardSlug: 'netflix',
      url: 'https://api.lever.co/v0/postings/netflix?mode=json',
      extractCount: (d: any) => (Array.isArray(d) ? d.length : 0),
    },
    {
      atsType: 'Ashby',
      boardSlug: 'openai',
      url: 'https://api.ashbyhq.com/posting-api/job-board/openai',
      extractCount: (d: any) => d?.jobs?.length || 0,
    },
    {
      atsType: 'Ashby',
      boardSlug: 'linear',
      url: 'https://api.ashbyhq.com/posting-api/job-board/linear',
      extractCount: (d: any) => d?.jobs?.length || 0,
    },
    {
      atsType: 'SmartRecruiters',
      boardSlug: 'visa',
      url: 'https://api.smartrecruiters.com/v1/companies/visa/postings?limit=100&offset=0',
      extractCount: (d: any) => d?.content?.length || 0,
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const target of targets) {
    console.log(`[Testing Live] ${target.atsType} (${target.boardSlug})...`);
    const res = await benchmarkAts(target.atsType, target.boardSlug, target.url, target.extractCount);
    results.push(res);
    console.log(`  -> Status: HTTP ${res.statusCode} | Full RTT: ${res.rttMs}ms | Items: ${res.itemCount}`);
    console.log(`  -> ETag: ${res.etag || 'None'} | 304 Support: ${res.supports304} (${res.conditional304RttMs ? res.conditional304RttMs + 'ms' : 'N/A'})\n`);
  }

  console.log('========================================================================');
  console.log('  LIVE ATS BENCHMARK SUMMARY TABLE');
  console.log('========================================================================');
  console.table(
    results.map((r) => ({
      ATS: r.atsType,
      Company: r.boardSlug,
      'HTTP Status': r.statusCode,
      'Full RTT (ms)': r.rttMs,
      'Has ETag': Boolean(r.etag),
      '304 Verified': r.supports304,
      '304 RTT (ms)': r.conditional304RttMs || 'N/A',
      'Active Jobs': r.itemCount,
    }))
  );
}

runLiveBenchmarks().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
