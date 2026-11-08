(function (window, document) {
  'use strict';

  var COLOR = {
    'A': '#00B50E',
    'B': '#53D700',
    'C': '#FDF400',
    'D': '#FF6C00',
    'F': '#C40009'
  };

  var NAV_ITEMS = [
    [/overview/, '.overview-nav'],
    [/code_index/, '.code-index-nav'],
    [/smells_index/, '.smells-index-nav'],
    [/simple_cov_index/, '.coverage-index-nav']
  ];

  var RubyCritic = {};

  // Runs every behavior. Called once, when the DOM is ready.
  RubyCritic.init = function () {
    RubyCritic.activateSidebarNav();
    RubyCritic.initMenuToggle();
    RubyCritic.initCharts();
    RubyCritic.initCodeView();
    RubyCritic.initTables();
    RubyCritic.initTimestamps();
  };

  // Marks the sidebar item of the current page as active.
  RubyCritic.activateSidebarNav = function () {
    var loc = window.location.href;
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i][0].test(loc)) {
        document.querySelectorAll(NAV_ITEMS[i][1]).forEach(function (item) {
          item.classList.add('active');
        });
        return;
      }
    }
  };

  // The header button that shows or hides the sidebar on small screens.
  // application.css does the layout for #wrapper.toggled.
  RubyCritic.initMenuToggle = function () {
    var button = document.getElementById('menu-toggle');
    var wrapper = document.getElementById('wrapper');
    if (!button || !wrapper) {
      return;
    }
    button.addEventListener('click', function (event) {
      event.preventDefault();
      wrapper.classList.toggle('toggled');
    });
  };

  // Charts on the overview page, drawn with Chart.js. The page defines the
  // turbulenceData ([{name, x: churn, y: complexity, rating}]) and score
  // globals in an inline script.
  var RATINGS = ['A', 'B', 'C', 'D', 'F'];

  RubyCritic.initCharts = function () {
    var turbulenceData = window.turbulenceData || [];
    drawChurnVsComplexity(document.getElementById('churn-vs-complexity-graph-container'), turbulenceData);
    drawGpa(document.getElementById('gpa-chart'), turbulenceData, window.score);
  };

  // Adds a <canvas> to the container. role="img" and aria-label describe the
  // chart for screen readers.
  function addCanvas(container, label) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    container.appendChild(canvas);
    return canvas;
  }

  function drawChurnVsComplexity(container, turbulenceData) {
    if (!container || !window.Chart) {
      return;
    }
    var canvas = addCanvas(container, 'Churn vs complexity of each module');
    new window.Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          data: turbulenceData,
          backgroundColor: turbulenceData.map(function (module) { return COLOR[module.rating]; }),
          pointRadius: 5,
          pointHoverRadius: 6,
          pointHoverBorderColor: 'rgb(100,100,100)',
          // Draw points at the axis ends in full.
          clip: false
        }]
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          // grace leaves room above the largest value.
          x: {title: {display: true, text: 'Churn'}, min: 0, grace: '5%'},
          y: {title: {display: true, text: 'Complexity'}, min: 0, grace: '5%'}
        },
        plugins: {
          title: {display: true, text: 'Churn vs Complexity'},
          legend: {display: false},
          tooltip: {
            callbacks: {
              title: function (items) { return items[0].raw.name; },
              label: function (item) {
                return 'Committed ' + item.parsed.x + ' times, with Flog score of ' + item.parsed.y;
              }
            }
          }
        }
      }
    });
  }

  function drawGpa(container, turbulenceData, score) {
    if (!container || !window.Chart) {
      return;
    }
    var scoreText = Number(score).toFixed(2);
    var canvas = addCanvas(container, 'Share of modules by rating. Score: ' + scoreText + ' of 100');
    var label = scoreLabel(scoreText);
    container.appendChild(label);

    new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: RATINGS,
        datasets: [{
          data: gpaData(turbulenceData),
          backgroundColor: RATINGS.map(function (rating) { return COLOR[rating]; }),
          radius: '90%'
        }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {display: true, position: 'bottom'},
          tooltip: {
            callbacks: {
              label: function (item) { return item.label + ': ' + item.raw + ' %'; }
            }
          }
        }
      },
      plugins: [{
        id: 'gpaScore',
        // Centers the score on the donut. The legend makes the chart area
        // smaller than the canvas, so use the chart area, not the canvas.
        afterDraw: function (chart) {
          var area = chart.chartArea;
          label.style.left = (area.left + area.right) / 2 + 'px';
          label.style.top = (area.top + area.bottom) / 2 + 'px';
        }
      }]
    });
  }

  // <div class="gpa-score"><span class="obtained-score">87.50</span><span class="total-score">/100</span></div>
  function scoreLabel(scoreText) {
    var label = document.createElement('div');
    label.className = 'gpa-score';
    [['obtained-score', scoreText], ['total-score', '/100']].forEach(function (part) {
      var span = document.createElement('span');
      span.className = part[0];
      span.textContent = part[1];
      label.appendChild(span);
    });
    return label;
  }

  // Percentage of modules per rating, A to F, with 2 decimals.
  function gpaData(turbulenceData) {
    var total = turbulenceData.length;
    return RATINGS.map(function (rating) {
      var count = turbulenceData.filter(function (module) { return module.rating === rating; }).length;
      return parseFloat(((count / total) * 100).toFixed(2));
    });
  }

  // The code file page: smell links and the code/smells toggle buttons. The
  // report generator highlights the code and writes the line ids (L1, L2, ...).
  RubyCritic.initCodeView = function () {
    var code = document.querySelector('.js-file-code');
    if (code) {
      code.addEventListener('click', function (event) {
        emphasizeLineFromLink(code, event);
      });
    }
    onClick('toggle-code', showCode);
    onClick('toggle-smells', showSmells);

    emphasizeLine(window.location.hash);
  };

  function onClick(id, handler) {
    var element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  // A click on a smell location link for this page highlights that line.
  // Ctrl-click and links to other pages are left to the browser.
  function emphasizeLineFromLink(code, event) {
    var link = event.target.closest('.js-smell-location');
    if (!link || !code.contains(link) || !hrefTargetIsOnCurrentPage(link) || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    code.querySelectorAll('li.highlight').forEach(function (line) {
      line.classList.remove('highlight');
    });
    emphasizeLine('#' + link.href.split('#')[1]);
  }

  function hrefTargetIsOnCurrentPage(aTag) {
    return (window.location.pathname === aTag.pathname);
  }

  // lineReference is a URL fragment such as "#L12". application.css gives
  // code lines a scroll-margin-top, so the fixed header does not cover them.
  function emphasizeLine(lineReference) {
    var line = lineFromReference(lineReference);
    if (!line) {
      return;
    }
    if (window.location.hash !== lineReference) {
      window.location.hash = lineReference;
    }
    line.scrollIntoView({behavior: 'smooth', block: 'start'});
    line.classList.add('highlight');
  }

  // getElementById, not querySelector, so that any fragment text is safe.
  function lineFromReference(lineReference) {
    if (!lineReference || lineReference.charAt(0) !== '#') {
      return null;
    }
    return document.getElementById(lineReference.slice(1));
  }

  // Marks the <li> of the clicked toggle button as active.
  function activateToggle(id) {
    ['toggle-code', 'toggle-smells'].forEach(function (toggle) {
      var item = document.getElementById(toggle);
      if (item && item.parentElement.tagName === 'LI') {
        item.parentElement.classList.toggle('active', toggle === id);
      }
    });
  }

  function showSmellLists(visible) {
    document.querySelectorAll('.smells').forEach(function (smells) {
      smells.style.display = visible ? '' : 'none';
    });
  }

  function showCode() {
    activateToggle('toggle-code');
    showSmellLists(false);
  }

  function showSmells() {
    activateToggle('toggle-smells');
    showSmellLists(true);
  }

  // Sorting and filtering for the code, smells and coverage tables.
  RubyCritic.initTables = function () {
    TABLE_SORTS.forEach(function (sort) {
      makeSortable(document.getElementById(sort[0]), sort[1], sort[2]);
    });
    TABLE_FILTERS.forEach(function (filter) {
      addTableFilter(document.getElementById(filter[0]), filter[1]);
    });
  };

  // Column indexes that the filter does not search.
  var TABLE_FILTERS = [
    ['codeTable', {ignoreColumns: [2], placeholder: 'Filter by Name'}],
    ['smellsTable', {ignoreColumns: [2], placeholder: 'Filter by Smell or Location'}],
    ['coverageTable', {ignoreColumns: [0], placeholder: 'Filter by Smell or Location'}]
  ];
  // Smaller tables get no search box.
  var FILTER_MIN_ROWS = 8;

  // Puts <p class="filter-table">Filter: <input type="search"></p> before the table.
  function addTableFilter(table, options) {
    var body = table && table.tBodies[0];
    if (!body || body.rows.length < FILTER_MIN_ROWS) {
      return;
    }
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = options.placeholder;
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    });
    input.addEventListener('input', function () {
      filterRows(body, input.value, options.ignoreColumns);
    });

    var container = document.createElement('p');
    container.className = 'filter-table';
    container.appendChild(document.createTextNode('Filter: '));
    container.appendChild(input);
    table.parentNode.insertBefore(container, table);
  }

  // Hides the rows that have no cell with the text. Case does not matter.
  function filterRows(body, text, ignoreColumns) {
    var needle = text.toUpperCase();
    Array.prototype.forEach.call(body.rows, function (row) {
      row.hidden = needle !== '' && !Array.prototype.some.call(row.cells, function (cell, index) {
        return ignoreColumns.indexOf(index) === -1 && cell.textContent.toUpperCase().indexOf(needle) !== -1;
      });
    });
  }

  // Column index and direction of the sort when the page opens.
  var TABLE_SORTS = [
    ['codeTable', 0, 'desc'],
    ['smellsTable', 0, 'asc'],
    ['coverageTable', 0, 'desc']
  ];

  // Sorts the rows now, and again when a header is clicked. A click on a new
  // column sorts it ascending; a click on the sorted column reverses it.
  function makeSortable(table, column, direction) {
    var body = table && table.tBodies[0];
    if (!body || !table.tHead) {
      return;
    }
    // The original position breaks ties, in both directions.
    var entries = Array.prototype.map.call(body.rows, function (row, index) {
      return {row: row, index: index};
    });
    var headers = table.tHead.rows[0].cells;
    var sorted = {column: column, direction: direction};

    sortRows(body, entries, column, direction);

    Array.prototype.forEach.call(headers, function (header, index) {
      header.addEventListener('click', function () {
        var next = (sorted.column === index && sorted.direction === 'asc') ? 'desc' : 'asc';
        sorted = {column: index, direction: next};
        sortRows(body, entries, index, next);
        markSortedHeader(headers, header, next);
      });
    });
  }

  function sortRows(body, entries, column, direction) {
    var keys = sortKeys(entries, column);
    var sign = direction === 'desc' ? -1 : 1;
    var order = entries.slice().sort(function (a, b) {
      return sign * compareKeys(keys[a.index], keys[b.index]) || a.index - b.index;
    });
    var fragment = document.createDocumentFragment();
    order.forEach(function (entry) {
      fragment.appendChild(entry.row);
    });
    body.appendChild(fragment);
  }

  var NUMBER = /^[-+]?\d+(\.\d+)?%?$/;

  // One key per row, by original position. A column is numeric when every
  // non-empty cell is a number, with or without a "%" at the end.
  function sortKeys(entries, column) {
    var texts = [];
    entries.forEach(function (entry) {
      var cell = entry.row.cells[column];
      texts[entry.index] = cell ? cell.textContent.trim().replace(/,/g, '') : '';
    });
    var numeric = texts.every(function (text) {
      return text === '' || NUMBER.test(text);
    });
    return texts.map(function (text) {
      if (numeric) {
        return text === '' ? -Infinity : parseFloat(text);
      }
      return text.toLowerCase();
    });
  }

  function compareKeys(a, b) {
    if (typeof a === 'number') {
      return a === b ? 0 : (a < b ? -1 : 1);
    }
    return a.localeCompare(b);
  }

  // The arrow (.sort-type) shows on the sorted header only. See application.css.
  function markSortedHeader(headers, sortedHeader, direction) {
    Array.prototype.forEach.call(headers, function (header) {
      var active = header === sortedHeader;
      var arrow = header.querySelector('.sort-type');
      header.classList.toggle('active', active);
      if (arrow) {
        arrow.classList.toggle('table-header-asc', active && direction === 'asc');
        arrow.classList.toggle('table-header-desc', active && direction === 'desc');
      }
    });
  }

  // "Updated 3 days ago" timestamps. The <time> datetime is ISO 8601 (see
  // ViewHelpers#timeago_tag). The title keeps the absolute time.
  var MINUTE = 60 * 1000;
  var DAY = 24 * 60 * MINUTE;
  // Largest unit first. Values round down, so 45 days is "1 month ago".
  var TIME_UNITS = [
    ['year', 365 * DAY],
    ['month', 30 * DAY],
    ['day', DAY],
    ['hour', 60 * MINUTE],
    ['minute', MINUTE],
    ['second', 1000]
  ];
  // English, like the rest of the report.
  var relativeTimeFormat = new Intl.RelativeTimeFormat('en', {numeric: 'always'});

  RubyCritic.initTimestamps = function () {
    var times = document.querySelectorAll('.js-timeago');
    if (!times.length) {
      return;
    }
    times.forEach(function (time) {
      if (!time.title) {
        time.title = time.textContent.trim();
      }
    });
    renderTimestamps(times);
    window.setInterval(function () { renderTimestamps(times); }, MINUTE);
  };

  function renderTimestamps(times) {
    times.forEach(function (time) {
      var text = relativeTime(Date.parse(time.getAttribute('datetime')), Date.now());
      if (text) {
        time.textContent = text;
      }
    });
  }

  // Returns null when "then" is not a valid date.
  function relativeTime(then, now) {
    if (isNaN(then)) {
      return null;
    }
    var elapsed = now - then;
    for (var i = 0; i < TIME_UNITS.length; i++) {
      var unit = TIME_UNITS[i][0], size = TIME_UNITS[i][1];
      if (Math.abs(elapsed) >= size || unit === 'second') {
        return relativeTimeFormat.format(-Math.trunc(elapsed / size), unit);
      }
    }
  }

  window.RubyCritic = RubyCritic;

  // Wait for the full DOM before running anything.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', RubyCritic.init);
  } else {
    window.setTimeout(RubyCritic.init, 0);
  }
})(window, document);
