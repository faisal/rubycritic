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
<ol class="nocode errors smells"><li><div class="description">Smell
<a href="foo.html#L2" class="js-smell-location">0</a>
<a href="bar.html#L2" class="js-smell-location">1</a></div></li></ol>  def bar; end
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
      ['init', 'activateSidebarNav', 'initMenuToggle', 'initCharts', 'initCodeView', 'initTables', 'initTimestamps'].forEach((name) => {
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

  describe('mobile menu button', () => {
    const LAYOUT = `
      <header><a href="#menu-toggle" id="menu-toggle" aria-label="Toggle navigation menu">menu</a></header>
      <div id="wrapper"><aside id="sidebar-wrapper"></aside></div>`;
    let window;

    beforeEach(async () => {
      window = await loadReport({ body: LAYOUT, page: 'code_index.html' });
    });

    it('shows or hides the sidebar with each click', () => {
      const wrapper = window.document.getElementById('wrapper');
      const button = window.document.getElementById('menu-toggle');

      button.click();
      expect(wrapper.classList.contains('toggled')).toBeTrue();

      button.click();
      expect(wrapper.classList.contains('toggled')).toBeFalse();
    });

    // jsdom does not follow fragment links, so check that the click is cancelled.
    it('does not follow the "#menu-toggle" link', () => {
      const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
      window.document.getElementById('menu-toggle').dispatchEvent(click);

      expect(click.defaultPrevented).toBeTrue();
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

  describe('smell location links', () => {
    let window;
    let scrolls;

    // jsdom has no scrollIntoView, so record the calls.
    const recordScrolls = (w) => {
      w.Element.prototype.scrollIntoView = function scrollIntoView(options) {
        scrolls.push({ id: this.id, options });
      };
    };
    const line = (id) => window.document.getElementById(id);
    const highlighted = () => [...window.document.querySelectorAll('.js-file-code li.highlight')].map((li) => li.id);
    const clickLink = (href, init = {}) => {
      const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, ...init });
      window.document.querySelector(`a[href="${href}"]`).dispatchEvent(click);
      return click;
    };

    beforeEach(async () => {
      scrolls = [];
      window = await loadReport({ body: CODE_FILE, page: 'lib/foo.html', before: recordScrolls });
      scrolls = [];
    });

    it('smoothly scrolls to and highlights a line on the same page', () => {
      const click = clickLink('foo.html#L2');

      expect(scrolls).toEqual([{ id: 'L2', options: { behavior: 'smooth', block: 'start' } }]);
      expect(highlighted()).toEqual(['L2']);
      expect(window.location.hash).toBe('#L2');
      expect(click.defaultPrevented).toBeTrue();
    });

    it('moves the highlight when another line is chosen', () => {
      line('L0').classList.add('highlight');

      clickLink('foo.html#L2');

      expect(highlighted()).toEqual(['L2']);
    });

    it('lets the browser handle a ctrl-click', () => {
      const click = clickLink('foo.html#L2', { ctrlKey: true });

      expect(scrolls).toEqual([]);
      expect(highlighted()).toEqual([]);
      expect(click.defaultPrevented).toBeFalse();
    });

    it('lets the browser follow a link to another page', () => {
      const click = clickLink('bar.html#L2');

      expect(scrolls).toEqual([]);
      expect(click.defaultPrevented).toBeFalse();
    });

    it('keeps code lines clear of the fixed header when scrolled to', () => {
      expect(window.getComputedStyle(line('L2')).scrollMarginTop).toBe('87px');
    });
  });

  describe('opening a code file at a line', () => {
    it('scrolls to and highlights the line in the URL fragment', async () => {
      const scrolls = [];
      const window = await loadReport({
        body: CODE_FILE,
        page: 'lib/foo.html#L1',
        before: (w) => {
          w.Element.prototype.scrollIntoView = function scrollIntoView(options) {
            scrolls.push({ id: this.id, options });
          };
        },
      });

      expect(scrolls).toEqual([{ id: 'L1', options: { behavior: 'smooth', block: 'start' } }]);
      expect([...window.document.querySelectorAll('li.highlight')].map((li) => li.id)).toEqual(['L1']);
    });

    it('does nothing when the URL has no fragment', async () => {
      const window = await loadReport({ body: CODE_FILE, page: 'lib/foo.html' });

      expect(window.document.querySelectorAll('.highlight').length).toBe(0);
    });
  });

  describe('relative timestamps', () => {
    const NOW = Date.parse('2026-11-06T12:00:00Z');
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    let intervals;

    // Fixes the page clock at NOW and records setInterval calls.
    const loadTimestamp = (datetime, text = datetime) => loadReport({
      body: `<span>Updated <time class="js-timeago" datetime="${datetime}">${text}</time></span>`,
      page: 'lib/foo.html',
      before: (w) => {
        w.Date.now = () => NOW;
        w.setInterval = (callback, delay) => intervals.push({ callback, delay });
      },
    });
    const iso = (ms) => new Date(ms).toISOString();

    beforeEach(() => {
      intervals = [];
    });

    [
      [30 * SECOND, '30 seconds ago'],
      [5 * MINUTE, '5 minutes ago'],
      [3 * HOUR, '3 hours ago'],
      [1 * DAY, '1 day ago'],
      [3 * DAY, '3 days ago'],
      [45 * DAY, '1 month ago'],
      [400 * DAY, '1 year ago'],
      [-2 * HOUR, 'in 2 hours'],
    ].forEach(([age, expected]) => {
      it(`shows "${expected}" for that age`, async () => {
        const window = await loadTimestamp(iso(NOW - age));

        expect(window.document.querySelector('time').textContent).toBe(expected);
      });
    });

    it('reads the ISO 8601 datetime that the Ruby helper writes', async () => {
      const window = await loadTimestamp('2018-10-31T18:01:36-03:00', '2018-10-31 18:01:36 -0300');

      expect(window.document.querySelector('time').textContent).toBe('8 years ago');
    });

    it('keeps the absolute time as the title', async () => {
      const window = await loadTimestamp('2018-10-31T18:01:36-03:00', '2018-10-31 18:01:36 -0300');

      expect(window.document.querySelector('time').title).toBe('2018-10-31 18:01:36 -0300');
    });

    it('uses English, like the rest of the report', async () => {
      const window = await loadReport({
        body: `<time class="js-timeago" datetime="${iso(NOW - 3 * DAY)}"></time>`,
        page: 'lib/foo.html',
        before: (w) => {
          w.Date.now = () => NOW;
          Object.defineProperty(w.navigator, 'language', { value: 'de-DE' });
        },
      });

      expect(window.document.querySelector('time').textContent).toBe('3 days ago');
    });

    it('leaves the text unchanged when the datetime is not a date', async () => {
      const window = await loadTimestamp('not a date');

      expect(window.document.querySelector('time').textContent).toBe('not a date');
    });

    it('updates the text every minute', async () => {
      const window = await loadTimestamp(iso(NOW - 59 * MINUTE));
      const refresh = intervals.find((i) => i.delay === MINUTE);

      expect(refresh).withContext('a 60 second interval').toBeDefined();
      window.Date.now = () => NOW + 2 * MINUTE;
      refresh.callback();
      expect(window.document.querySelector('time').textContent).toBe('1 hour ago');
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
