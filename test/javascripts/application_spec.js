'use strict';

const { loadReport, highchartsStub } = require('./helpers/report_dom');

const SIDEBAR = `
  <a class="project-nav-item overview-nav">Overview</a>
  <a class="project-nav-item code-index-nav">Code</a>
  <a class="project-nav-item smells-index-nav">Smells</a>
  <a class="project-nav-item coverage-index-nav">Coverage</a>`;

// Same shape as code_file.html.erb + line/smelly_line templates produce.
const CODE_FILE = `
  <ul class="nav nav-pills">
    <li><a href="#" id="toggle-code">code</a></li>
    <li class="active"><a href="#" id="toggle-smells">1 smell</a></li>
  </ul>
  <code class="prettyprint linenums lang-ruby file-code js-file-code">class Foo
<ol class="nocode errors smells"><li><div class="description">Smell</div></li></ol>  def bar; end
end
</code>`;

const OVERVIEW = `
  <div id="gpa-chart"></div>
  <div id="churn-vs-complexity-graph-container"></div>`;

const TURBULENCE = [
  { name: 'Foo', x: 3, y: 10, rating: 'A' },
  { name: 'Bar', x: 1, y: 40, rating: 'F' },
];

describe('application.js', () => {
  describe('the RubyCritic namespace', () => {
    it('exposes each report behavior as a named function', async () => {
      const window = await loadReport();

      expect(typeof window.RubyCritic).toBe('object');
      ['init', 'activateSidebarNav', 'initCharts', 'initCodeView', 'initTables', 'initTimestamps'].forEach((name) => {
        expect(typeof (window.RubyCritic || {})[name]).withContext(name).toBe('function');
      });
    });
  });

  describe('sidebar navigation', () => {
    [
      ['overview.html', 'overview-nav'],
      ['code_index.html', 'code-index-nav'],
      ['smells_index.html', 'smells-index-nav'],
      ['simple_cov_index.html', 'coverage-index-nav'],
    ].forEach(([page, navClass]) => {
      it(`marks only the ${navClass} item active on ${page}`, async () => {
        const window = await loadReport({ body: SIDEBAR, page });
        const active = [...window.document.querySelectorAll('.project-nav-item.active')];

        expect(active.map((a) => a.className)).toEqual([`project-nav-item ${navClass} active`]);
      });
    });
  });

  describe('code file view', () => {
    let window;

    beforeEach(async () => {
      window = await loadReport({ body: CODE_FILE, page: 'lib/foo.html' });
    });

    it('gives each code line an id', () => {
      const ids = [...window.document.querySelectorAll('.js-file-code ol.linenums > li')].map((li) => li.id);

      expect(ids).toEqual(['L0', 'L1', 'L2']);
    });

    it('hides the smells when "code" is clicked', () => {
      window.document.getElementById('toggle-code').click();

      expect(window.document.querySelector('.smells').style.display).toBe('none');
      expect(window.document.getElementById('toggle-code').parentElement.classList.contains('active')).toBeTrue();
      expect(window.document.getElementById('toggle-smells').parentElement.classList.contains('active')).toBeFalse();
    });

    it('shows the smells again when "smells" is clicked', () => {
      window.document.getElementById('toggle-code').click();
      window.document.getElementById('toggle-smells').click();

      expect(window.document.querySelector('.smells').style.display).not.toBe('none');
      expect(window.document.getElementById('toggle-smells').parentElement.classList.contains('active')).toBeTrue();
      expect(window.document.getElementById('toggle-code').parentElement.classList.contains('active')).toBeFalse();
    });
  });

  describe('relative timestamps', () => {
    it('shows "Updated" times as a relative time', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const window = await loadReport({
        body: `<time class="js-timeago" datetime="${threeDaysAgo}">${threeDaysAgo}</time>`,
        page: 'lib/foo.html',
      });

      expect(window.document.querySelector('time').textContent).toBe('3 days ago');
    });
  });

  describe('overview charts', () => {
    let calls;

    beforeEach(async () => {
      calls = [];
      await loadReport({
        body: OVERVIEW,
        before: (window) => {
          window.turbulenceData = JSON.parse(JSON.stringify(TURBULENCE));
          window.score = 87.5;
        },
        stubs: { 'highcharts.src-4.0.1.js': highchartsStub(calls) },
      });
    });

    it('draws the churn vs complexity scatter chart with one color per rating', () => {
      const scatter = calls.find((c) => c.id === 'churn-vs-complexity-graph-container');

      expect(scatter.options.chart.type).toBe('scatter');
      expect(scatter.options.series[0].data.map((p) => [p.name, p.color])).toEqual([
        ['Foo', '#00B50E'],
        ['Bar', '#C40009'],
      ]);
    });

    it('draws the GPA donut chart with the percentage of modules per rating', () => {
      const donut = calls.find((c) => c.id === 'gpa-chart');

      expect(donut.options.chart.type).toBe('pie');
      expect(donut.options.series[0].data.map((d) => [d.name, d.y])).toEqual([
        ['A', 50], ['B', 0], ['C', 0], ['D', 0], ['F', 50],
      ]);
    });
  });
});
