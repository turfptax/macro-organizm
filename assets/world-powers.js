/* Nations page boot: all behaviour lives in assets/graph.js, the content in data/world-powers.js. */
(function () {
  'use strict';
  if (!window.MacroGraph || !window.WORLD_POWERS) {
    if (window.MacroShell) window.MacroShell.fatal('The page files did not load', 'One of data/world-powers.js, assets/graph-model.js, assets/ui.js or assets/graph.js is missing. Reload the page, and check that the files are on the server.');
    return;
  }
  window.NATIONS_GRAPH = window.MacroGraph.create({
    data: window.WORLD_POWERS,
    root: document.getElementById('graph-root'),
    storage: 'mo-graph:world-powers',
    file: 'world-powers',
    words: { entity: 'nation', entities: 'nations', tie: 'relationship', ties: 'relationships', mapTitle: 'Relationship map', membersHead: 'Highlight members of' },
    layout: { distance: 110, charge: 330, chargeMax: 700, gravity: 0.03 },
    d3Script: 'd3-script',
    yearLabel: 'Ties as of year',
    yearHint: 'a nation shows in every year unless it has a start date',
    keyNotes: ['The EU and Russia share one colour, as in the site-wide palette used on Money Over Time and Money Flow. The EU is a square and Russia a circle, and every name is written out.'],
  });
  // the filters and key start closed on screens shorter than 1000px so the graph is in view on arrival
  const keyPanel = document.querySelector('.gr-filters');
  if (keyPanel && window.innerHeight < 1000) keyPanel.open = false;
})();
