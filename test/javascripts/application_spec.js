'use strict';

const { loadReport, highchartsStub } = require('./helpers/report_dom');

const SIDEBAR = `
  <a class="project-nav-item overview-nav">Overview</a>
  <a class="project-nav-item code-index-nav">Code</a>
  <a class="project-nav-item smells-index-nav">Smells</a>
  <a class="project-nav-item coverage-index-nav">Coverage</a>`;

// Same shape as code_file.html.erb renders it: Rouge token spans, one <li id="L<n>">
// per source line, and the smells inside the item of their line.
const CODE_FILE = `
  <ul class="nav nav-pills">
    <li><a href="#" id="toggle-code">code</a></li>
    <li class="active"><a href="#" id="toggle-smells">1 smell</a></li>
  </ul>
  <code class="file-code js-file-code"><ol class="linenums"><li id="L1"><span class="k">class</span> <span class="nc">Foo</span><ol class="nocode errors smells"><li><div class="description">Smell <a href="foo.html#L2" class="js-smell-location">0</a> <a href="bar.html#L2" class="js-smell-location">1</a></div></li></ol></li><li id="L2">  <span class="k">def</span> <span class="nf">bar</span><span class="p">;</span> <span class="s2">"x"</span> <span class="c1"># note</span></li><li id="L3"><span class="k">end</span></li></ol></code>`;

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

    it('keeps the line ids that the report generator wrote', () => {
      const ids = [...window.document.querySelectorAll('.js-file-code ol.linenums > li')].map((li) => li.id);

      expect(ids).toEqual(['L1', 'L2', 'L3']);
    });

    // Same colors as the old Prettify theme.
    [
      ['.k', 'keyword', 'rgb(0, 119, 170)'],
      ['.nc', 'class name', 'rgb(153, 0, 85)'],
      ['.s2', 'string', 'rgb(102, 153, 0)'],
      ['.c1', 'comment', 'rgb(136, 0, 0)'],
      ['.p', 'punctuation', 'rgb(102, 102, 0)'],
      ['.nf', 'method name', 'rgb(0, 0, 0)'],
    ].forEach(([selector, kind, color]) => {
      it(`colors a ${kind} ${color}`, () => {
        const span = window.document.querySelector(`.js-file-code ${selector}`);

        expect(window.getComputedStyle(span).color).toBe(color);
      });
    });

    // jsdom does not compute ::marker styles, so look for the rule itself.
    it('shows the line numbers in gray', () => {
      const style = [...window.document.querySelectorAll('style')].map((s) => s.textContent).join('\n');

      expect(style).toMatch(/\.file-code ol\.linenums > li::marker\s*\{\s*color: #999;/);
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
      line('L3').classList.add('highlight');

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

  describe('table sorting', () => {
    // Same columns as the index templates. Names sit in a nav-pills link with
    // whitespace around it, as in code_index.html.erb.
    const table = (id, headers, rows) => `
      <table id="${id}" class="table sortable-table tablesorter">
        <thead><tr>${headers.map((h) => `<th class="table-header">${h}<span class="sort-type"></span></th>`).join('')}</tr></thead>
        <tbody>${rows.map(([name, ...cells]) => `<tr data-name="${name}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    const link = (name) => `
                <ul class="nav nav-pills"><li><a href="#">${name}</a></li></ul>
              `;
    // name, rating, churn, complexity
    const CODE = [['Alpha', 'A', '10', '5.5'], ['beta', 'F', '9', '12.25'], ['Gamma', 'C', '100', '3'], ['Delta', 'F', '10', '7']];
    const codeTable = table('codeTable', ['Rating', 'Name', 'Churn', 'Complexity', 'Duplication', 'Smells'],
      CODE.map(([name, rating, churn, complexity]) => [name, rating, link(name), churn, complexity, '0', '1']));
    const smellsTable = table('smellsTable', ['Smell', 'Locations', 'Status'],
      [['Mu', 'UtilityFunction', 'Foo#bar', 'new'], ['Nu', 'DuplicateCode', 'Foo', 'old'], ['Xi', 'FeatureEnvy', 'Bar', 'new']]);
    const coverageTable = table('coverageTable', ['Rating', 'Name', 'Coverage'],
      [['Zeta', 'B', link('Zeta'), '9.50%'], ['Eta', 'B', link('Eta'), '100.00%'], ['Theta', 'A', link('Theta'), '10.00%']]);

    const order = (window, id) => [...window.document.querySelectorAll(`#${id} tbody tr`)].map((row) => row.dataset.name);
    const header = (window, id, text) => [...window.document.querySelectorAll(`#${id} th`)].find((th) => th.textContent === text);
    // Waits a little after the click, because a sorter can sort in a timer.
    const click = (window, id, text) => {
      header(window, id, text).click();
      return new Promise((resolve) => window.setTimeout(resolve, 10));
    };
    const indicator = (window, id, text) => {
      const th = header(window, id, text);
      return [th.classList.contains('active'), th.querySelector('.sort-type').className];
    };

    describe('when the page opens', () => {
      it('sorts the code table by rating, worst first', async () => {
        const window = await loadReport({ body: codeTable, page: 'code_index.html' });

        expect(order(window, 'codeTable')).toEqual(['beta', 'Delta', 'Gamma', 'Alpha']);
      });

      it('sorts the smells table by smell name, A to Z', async () => {
        const window = await loadReport({ body: smellsTable, page: 'smells_index.html' });

        expect(order(window, 'smellsTable')).toEqual(['Nu', 'Xi', 'Mu']);
      });

      it('sorts the coverage table by rating, worst first', async () => {
        const window = await loadReport({ body: coverageTable, page: 'simple_cov_index.html' });

        expect(order(window, 'coverageTable')).toEqual(['Zeta', 'Eta', 'Theta']);
      });
    });

    describe('when a header is clicked', () => {
      let window;

      beforeEach(async () => {
        window = await loadReport({ body: codeTable, page: 'code_index.html' });
      });

      it('sorts by that column, then reverses with each click', async () => {
        await click(window, 'codeTable', 'Name');
        expect(order(window, 'codeTable')).toEqual(['Alpha', 'beta', 'Delta', 'Gamma']);

        await click(window, 'codeTable', 'Name');
        expect(order(window, 'codeTable')).toEqual(['Gamma', 'Delta', 'beta', 'Alpha']);

        await click(window, 'codeTable', 'Name');
        expect(order(window, 'codeTable')).toEqual(['Alpha', 'beta', 'Delta', 'Gamma']);
      });

      it('sorts numbers as numbers', async () => {
        await click(window, 'codeTable', 'Complexity');

        expect(order(window, 'codeTable')).toEqual(['Gamma', 'Alpha', 'Delta', 'beta']);
      });

      it('keeps the original row order for equal values, in both directions', async () => {
        await click(window, 'codeTable', 'Churn');
        expect(order(window, 'codeTable')).toEqual(['beta', 'Alpha', 'Delta', 'Gamma']);

        await click(window, 'codeTable', 'Churn');
        expect(order(window, 'codeTable')).toEqual(['Gamma', 'Alpha', 'Delta', 'beta']);
      });

      it('shows an up arrow, then a down arrow, on the sorted header only', async () => {
        await click(window, 'codeTable', 'Name');
        expect(indicator(window, 'codeTable', 'Name')).toEqual([true, 'sort-type table-header-asc']);

        await click(window, 'codeTable', 'Name');
        expect(indicator(window, 'codeTable', 'Name')).toEqual([true, 'sort-type table-header-desc']);

        await click(window, 'codeTable', 'Churn');
        expect(indicator(window, 'codeTable', 'Name')).toEqual([false, 'sort-type']);
        expect(indicator(window, 'codeTable', 'Churn')).toEqual([true, 'sort-type table-header-asc']);
      });

      it('starts A to Z again when you come back to a column, to match the arrow', async () => {
        await click(window, 'codeTable', 'Name');
        await click(window, 'codeTable', 'Churn');
        await click(window, 'codeTable', 'Name');

        expect(order(window, 'codeTable')).toEqual(['Alpha', 'beta', 'Delta', 'Gamma']);
        expect(indicator(window, 'codeTable', 'Name')).toEqual([true, 'sort-type table-header-asc']);
      });

      it('keeps filtered-out rows hidden', async () => {
        window.document.querySelector('tr[data-name="Gamma"]').hidden = true;

        await click(window, 'codeTable', 'Name');

        expect(window.document.querySelector('tr[data-name="Gamma"]').hidden).toBeTrue();
      });
    });

    it('sorts percentages as numbers', async () => {
      const window = await loadReport({ body: coverageTable, page: 'simple_cov_index.html' });

      await click(window, 'coverageTable', 'Coverage');

      expect(order(window, 'coverageTable')).toEqual(['Zeta', 'Theta', 'Eta']);
    });
  });

  describe('table filters', () => {
    const NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

    // Same columns as code_index.html.erb, smells_index.html.erb and
    // simple_cov_index.html.erb. Each row has data-name for the assertions.
    const table = (id, headers, rows) => `
      <table id="${id}" class="table">
        <thead><tr>${headers.map((h) => `<th class="table-header">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(([name, ...cells]) => `<tr data-name="${name.replace(/"/g, '&quot;')}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    const codeRows = (names) => names.map((name, i) => [name, 'A', name, i === 0 ? '42' : '1', '3', '0', '2']);
    const codeTable = (names = NAMES) => table('codeTable', ['Rating', 'Name', 'Churn', 'Complexity', 'Duplication', 'Smells'], codeRows(names));
    const smellsTable = () => table('smellsTable', ['Smell', 'Locations', 'Status'],
      NAMES.map((name, i) => [name, `${name}Smell`, `${name}#call`, i === 0 ? 'new' : 'old']));
    const coverageTable = () => table('coverageTable', ['Rating', 'Name', 'Coverage'],
      NAMES.map((name, i) => [name, i === 0 ? 'Zeta' : 'B', name, '50.00%']));

    const visibleNames = (window, id) => [...window.document.querySelectorAll(`#${id} tbody tr`)]
      .filter((row) => !row.hidden && row.style.display !== 'none')
      .map((row) => row.dataset.name)
      .sort();
    const type = (window, id, text) => {
      const input = window.document.getElementById(id).previousElementSibling.querySelector('input');
      input.value = text;
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    };

    [
      ['codeTable', codeTable, 'Filter by Name'],
      ['smellsTable', smellsTable, 'Filter by Smell or Location'],
      ['coverageTable', coverageTable, 'Filter by Smell or Location'],
    ].forEach(([id, fixture, placeholder]) => {
      it(`puts a "${placeholder}" search box before #${id}`, async () => {
        const window = await loadReport({ body: fixture(), page: 'code_index.html' });
        const container = window.document.getElementById(id).previousElementSibling;

        expect(container.tagName).toBe('P');
        expect(container.className).toBe('filter-table');
        expect(container.textContent.trim()).toBe('Filter:');
        expect(container.querySelector('input').type).toBe('search');
        expect(container.querySelector('input').placeholder).toBe(placeholder);
      });
    });

    it('adds no search box to a table with fewer than 8 rows', async () => {
      const window = await loadReport({ body: codeTable(NAMES.slice(0, 7)), page: 'code_index.html' });

      expect(window.document.querySelector('.filter-table')).toBeNull();
    });

    it('shows only the rows that contain the text, ignoring case', async () => {
      const window = await loadReport({ body: codeTable(), page: 'code_index.html' });

      type(window, 'codeTable', 'eTa');

      expect(visibleNames(window, 'codeTable')).toEqual(['Beta', 'Eta', 'Theta', 'Zeta']);
    });

    it('does not match text in the ignored columns', async () => {
      const window = await loadReport({ body: codeTable(), page: 'code_index.html' });

      type(window, 'codeTable', '42'); // only in the Churn column, which is ignored

      expect(visibleNames(window, 'codeTable')).toEqual([]);
    });

    it('ignores the Status column of the smells table', async () => {
      const window = await loadReport({ body: smellsTable(), page: 'smells_index.html' });

      type(window, 'smellsTable', 'new');

      expect(visibleNames(window, 'smellsTable')).toEqual([]);
    });

    it('ignores the Rating column of the coverage table', async () => {
      const window = await loadReport({ body: coverageTable(), page: 'simple_cov_index.html' });

      type(window, 'coverageTable', 'zeta');

      expect(visibleNames(window, 'coverageTable')).toEqual(['Zeta']);
    });

    it('shows all rows again when the text is cleared', async () => {
      const window = await loadReport({ body: codeTable(), page: 'code_index.html' });

      type(window, 'codeTable', 'alpha');
      type(window, 'codeTable', '');

      expect(visibleNames(window, 'codeTable')).toEqual([...NAMES].sort());
    });

    it('matches quotes and parentheses as plain text', async () => {
      const names = [...NAMES.slice(0, 7), 'call("x")'];
      const window = await loadReport({ body: codeTable(names), page: 'code_index.html' });

      type(window, 'codeTable', 'call("x")');

      expect(visibleNames(window, 'codeTable')).toEqual(['call("x")']);
    });

    it('does not let the Enter key submit anything', async () => {
      const window = await loadReport({ body: codeTable(), page: 'code_index.html' });
      const input = window.document.querySelector('.filter-table input');
      const enter = new window.KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });

      input.dispatchEvent(enter);

      expect(enter.defaultPrevented).toBeTrue();
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
