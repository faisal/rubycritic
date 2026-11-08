(function (window, document, $) {
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
        $(NAV_ITEMS[i][1]).addClass('active');
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

  // Charts on the overview page. The page defines the turbulenceData and
  // score globals in an inline script.
  RubyCritic.initCharts = function () {
    drawChurnVsComplexity(window.turbulenceData || []);
    drawGpa(window.turbulenceData || [], window.score);
  };

  function drawChurnVsComplexity(turbulenceData) {
    $('#churn-vs-complexity-graph-container').highcharts({
      chart: {
        type: 'scatter',
        zoomType: 'xy'
      },
      title: {
        text: 'Churn vs Complexity'
      },
      xAxis: {
        title: {
          enabled: true,
          text: 'Churn'
        },
        floor: 0,
        startOnTick: true,
        endOnTick: true
      },
      yAxis: {
        title: {
          text: 'Complexity'
        },
        floor: 0,
        startOnTick: true,
        endOnTick: true
      },
      plotOptions: {
        series: {
          turboThreshold: 0
        },
        scatter: {
          marker: {
            radius: 5,
            states: {
              hover: {
                enabled: true,
                lineColor: 'rgb(100,100,100)'
              }
            }
          },
          tooltip: {
            headerFormat: '<b>{point.key}</b><br>',
            pointFormat: 'Committed {point.x} times, with Flog score of {point.y}'
          }
        }
      },
      series: [{
        showInLegend: false,
        color: 'steelblue',
        data: mapTurbulenceData(turbulenceData)
      }]
    });
  }

  function mapTurbulenceData(turbulenceData) {
    return turbulenceData.map(function (data) {
      data.color = COLOR[data.rating];
      return data;
    });
  }

  function drawGpa(turbulenceData, score) {
    $('#gpa-chart').highcharts({
      chart: {
        type: 'pie',
        events: {
          load: addTitle,
          redraw: addTitle
        }
      },
      title: {
        text: '',
        useHTML: true
      },
      plotOptions: {
        pie: {
          shadow: false
        }
      },
      tooltip: {
        formatter: function () {
          return '<b>' + this.point.name + '</b>: ' + this.y + ' %';
        }
      },
      series: [{
        name: 'Browsers',
        data: gpaData(turbulenceData),
        size: '90%',
        innerSize: '65%',
        showInLegend: true,
        dataLabels: {
          enabled: false
        }
      }]
    });

    // Highcharts calls this with the chart as "this".
    function addTitle() {
      if (this.title) {
        this.title.destroy();
      }
      var r = this.renderer,
          x = this.series[0].center[0] + this.plotLeft,
          y = this.series[0].center[1] + this.plotTop;
      this.title = r.label('<span class="obtained-score">' + score.toFixed(2) + '</span><span class="total-score">/100</span>', 0, 0, '', 0, 0, true)
        .css({
          color: 'black'
        }).hide().add();
      var bbox = this.title.getBBox();
      this.title.attr({
        x: x - (bbox.width / 2),
        y: y
      }).show();
      this.title.useHTML = true;
    }
  }

  function gpaData(turbulenceData) {
    var ratings = ['A', 'B', 'C', 'D', 'F'];
    var counts = ratings.map(function (rating) {
      return ratingCount(turbulenceData, rating);
    });
    var total = counts.reduce(function (sum, count) { return sum + count; }, 0);
    return ratings.map(function (rating, index) {
      return {name: rating, y: parseFloat(((counts[index] / total) * 100).toFixed(2)), color: COLOR[rating]};
    });
  }

  function ratingCount(turbulenceData, rating) {
    return turbulenceData.filter(function (data) {
      return data.rating === rating;
    }).length;
  }

  // The code file page: syntax highlighting, line ids, smell links and the
  // code/smells/coverage toggle buttons.
  RubyCritic.initCodeView = function () {
    if (typeof window.prettyPrint === 'function') {
      window.prettyPrint();
    }
    assignIdsToCodeLines();

    $('.js-file-code').on('click', '.js-smell-location', emphasizeLineFromHref);
    $('#toggle-code').on('click', showCode);
    $('#toggle-smells').on('click', showSmells);
    $('#toggle-coverage').on('click', showCoverage);

    emphasizeLine(window.location.hash);
  };

  function assignIdsToCodeLines() {
    $($('.linenums')[1]).children().each(function (index) {
      $(this).attr('id', 'L' + index);
    });
  }

  function emphasizeLineFromHref(event) {
    if (hrefTargetIsOnCurrentPage(this) && !event.ctrlKey) {
      $('.js-file-code li').removeClass('highlight');
      var lineId = '#' + this.href.split('#')[1];
      emphasizeLine(lineId);
      return false;
    }
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

  function activateToggle(id) {
    ['#toggle-code', '#toggle-smells', '#toggle-coverage'].forEach(function (toggle) {
      $(toggle).parent('li').toggleClass('active', toggle === id);
    });
  }

  function showCode() {
    activateToggle('#toggle-code');
    $('.smells').hide();
  }

  function showSmells() {
    activateToggle('#toggle-smells');
    $('.smells').show();
  }

  function showCoverage() {
    activateToggle('#toggle-coverage');
    $('.coverage').show();
  }

  // Sorting and filtering for the code, smells and coverage tables.
  RubyCritic.initTables = function () {
    $('#codeTable').tablesorter({sortList: [[0, 1]]});
    $('#smellsTable').tablesorter({sortList: [[0, 0]]});
    $('#coverageTable').tablesorter({sortList: [[0, 1]]});

    $('.table-header').click(markSortedHeader);

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

  function markSortedHeader() {
    $('.table-header').not(this).each(function () {
      $(this).removeClass('active');
      $(this).find('.sort-type').removeClass('table-header-asc');
      $(this).find('.sort-type').removeClass('table-header-desc');
    });
    if ($(this).hasClass('active')) {
      $(this).find('.sort-type').toggleClass('table-header-asc table-header-desc');
    }
    else {
      $(this).addClass('active');
      $(this).find('.sort-type').addClass('table-header-asc');
    }
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
})(window, document, window.jQuery);
