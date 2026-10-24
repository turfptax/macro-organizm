/* Power Structure page: hands data/power-structure.js to the shared graph engine (assets/graph.js).
   The data file holds the vocabulary, the claim line, the Method and Claims checked panels, and every record. */
(function () {
  'use strict';
  const Shell = window.MacroShell || null;
  function stop(title, detail) {
    if (Shell) Shell.fatal(title, detail);
    else if (window.console) console.error(title + ': ' + detail);
  }

  if (!window.POWER_STRUCTURE) { stop('The data did not load', 'data/power-structure.js is missing or has an error, so there is nothing to draw. Reload the page.'); return; }
  if (!window.MacroGraph) { stop('The page scripts did not load', 'assets/graph-model.js, assets/ui.js and assets/graph.js must all load. Reload the page.'); return; }

  const root = document.getElementById('graph-root');
  window.POWER_GRAPH = window.MacroGraph.create({
    data: window.POWER_STRUCTURE,
    root: root,
    storage: 'mo-graph:power-structure',
    file: 'power-structure',
    words: { entity: 'entity', entities: 'entities', tie: 'tie', ties: 'ties', mapTitle: 'Ties among institutions', out: 'Ties from', in: 'Ties to', mutual: 'Ties with' },
    // 168 entities: a taller stage and a layout that fills it keep more names readable on arrival
    layout: { chargeMax: 400, gravity: 0.045, aspect: 'stage' },
    tall: true,
    d3Script: 'd3-script',
  });

  // the key lists 14 kinds of entity and 18 kinds of tie; it starts folded so the graph is in view without scrolling
  const key = root && root.querySelector('.gr-filters');
  if (key) key.open = false;
})();
