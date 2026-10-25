// Curated by hand from the sources named in "sources". Not generated: edit it when a source changes.
window.MACRO_PRICES_CURATED = {
"updated":"2026-10-24",
"notes":[
  "Every point is an object {p, v, src, note}: p is the period (YYYY-MM-DD for events, YYYY-MM or YYYY otherwise), v the value, src a key in 'sources', note a short plain statement. Series are in 'series' with the same label, unit, source, url, retrieved and asOf fields as data/prices.js.",
  "These are cited points, not a continuous record. Do not join points of different series, and do not fill the years between points. Where a generated series in data/prices.js covers the same ground, the generated series wins and these points are only a fallback or an anchor.",
  "Pre-1980 dollar prices of everyday items have no free machine-readable source. The Coca-Cola span, the 1913 anchors and the stamp history are the documented exceptions, each with its source and its limits in the notes."
],
"sources":{
  "usps_rates":{"title":"Rates for Domestic Letters Since 1863","publisher":"United States Postal Service, Postal History","url":"https://about.usps.com/who/profile/history/domestic-letter-rates-since-1863.htm","accessed":"2026-10-24","licence":"Official USPS publication. Facts only; the page layout is not copied. Cite USPS Postal History."},
  "levy_young_2004":{"title":"The Real Thing: Nominal Price Rigidity of the Nickel Coke, 1886-1959","publisher":"Daniel Levy and Andrew Young, Journal of Money, Credit and Banking 36(4), August 2004, pp. 765-799 (preprint: MPRA Paper 1046)","url":"https://mpra.ub.uni-muenchen.de/1046/","accessed":"2026-10-24","licence":"Journal article. A single cited fact; no dataset licence applies. Cite the paper."},
  "bls_btn_2013":{"title":"Average food prices: a snapshot of how much has changed over a century","publisher":"U.S. Bureau of Labor Statistics, Beyond the Numbers, vol. 2 (2013), Table 1, January 1913 column","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","accessed":"2026-10-24","licence":"Public domain (US government work). Cite the Bureau of Labor Statistics."},
  "nass_quickstats":{"title":"Quick Stats: AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE, survey, national, annual","publisher":"USDA National Agricultural Statistics Service","url":"https://www.nass.usda.gov/datasets/","accessed":"2026-10-24","licence":"US federal agency data; no licence statement found, treated as public domain. Cite USDA NASS, Quick Stats."},
  "fhfa_land":{"title":"The Price of Residential Land for Counties, ZIP Codes, and Census Tracts in the United States (v4.0, June 2024), Panel Nation, all single-family parcels, land value per acre as-is","publisher":"Federal Housing Finance Agency (Davis, Larson, Oliner and Shui)","url":"https://www.fhfa.gov/document/land-prices_2024_20_june.xlsx","accessed":"2026-10-24","licence":"US federal agency product; no licence statement found, treated as public domain. Experimental estimates, subject to change. Cite the Federal Housing Finance Agency."}
},
"series":{
"stamp":{"label":"US first-class letter postage (the first-class stamp)","unit":"US cents","freq":"E","kind":"step","country":"US","group":"items","source":"United States Postal Service, Rates for Domestic Letters Since 1863","sourceId":"domestic-letter-rates-since-1863","url":"https://about.usps.com/who/profile/history/domestic-letter-rates-since-1863.htm","licence":"Official USPS publication. Facts only; cite USPS Postal History.","retrieved":"2026-10-24","asOf":"2026-07-12","notes":"Every change in the postage on a domestic letter, by effective date; the rate holds until the next point. The first two points (1863 and 1883) are per half ounce; from 1885-07-01 the rate is for the first ounce. The 3 cent rate of 1917-11-02 was followed by a return to 2 cents on 1919-07-01. Rates before 1863 are in a separate USPS table and are not included. The rate is a price per letter, not a price per unit of a fixed good: the service behind a stamp changed over the period.","breaks":[{"t":"1885-07-01","label":"Rates are per ounce from this date; the two earlier rates were per half ounce","kind":"definition"}],"data":[
  {"p":"1863-07-01","v":3,"src":"usps_rates","note":"Per half ounce. First row of the USPS table."},
  {"p":"1883-10-01","v":2,"src":"usps_rates","note":"Per half ounce. Down from 3 cents."},
  {"p":"1885-07-01","v":2,"src":"usps_rates","note":"Per ounce from this date. Still 2 cents."},
  {"p":"1917-11-02","v":3,"src":"usps_rates","note":"Up from 2 cents."},
  {"p":"1919-07-01","v":2,"src":"usps_rates","note":"Down from 3 cents."},
  {"p":"1932-07-06","v":3,"src":"usps_rates","note":"Up from 2 cents."},
  {"p":"1958-08-01","v":4,"src":"usps_rates","note":"Up from 3 cents."},
  {"p":"1963-01-07","v":5,"src":"usps_rates","note":"Up from 4 cents."},
  {"p":"1968-01-07","v":6,"src":"usps_rates","note":"Up from 5 cents."},
  {"p":"1971-05-16","v":8,"src":"usps_rates","note":"Up from 6 cents."},
  {"p":"1974-03-02","v":10,"src":"usps_rates","note":"Up from 8 cents."},
  {"p":"1975-12-31","v":13,"src":"usps_rates","note":"Up from 10 cents."},
  {"p":"1978-05-29","v":15,"src":"usps_rates","note":"Up from 13 cents."},
  {"p":"1981-03-22","v":18,"src":"usps_rates","note":"Up from 15 cents."},
  {"p":"1981-11-01","v":20,"src":"usps_rates","note":"Up from 18 cents."},
  {"p":"1985-02-17","v":22,"src":"usps_rates","note":"Up from 20 cents."},
  {"p":"1988-04-03","v":25,"src":"usps_rates","note":"Up from 22 cents."},
  {"p":"1991-02-03","v":29,"src":"usps_rates","note":"Up from 25 cents."},
  {"p":"1995-01-01","v":32,"src":"usps_rates","note":"Up from 29 cents."},
  {"p":"1999-01-10","v":33,"src":"usps_rates","note":"Up from 32 cents."},
  {"p":"2001-01-07","v":34,"src":"usps_rates","note":"Up from 33 cents."},
  {"p":"2002-06-30","v":37,"src":"usps_rates","note":"Up from 34 cents."},
  {"p":"2006-01-08","v":39,"src":"usps_rates","note":"Up from 37 cents."},
  {"p":"2007-05-14","v":41,"src":"usps_rates","note":"Up from 39 cents."},
  {"p":"2008-05-12","v":42,"src":"usps_rates","note":"Up from 41 cents."},
  {"p":"2009-05-11","v":44,"src":"usps_rates","note":"Up from 42 cents."},
  {"p":"2012-01-22","v":45,"src":"usps_rates","note":"Up from 44 cents."},
  {"p":"2013-01-27","v":46,"src":"usps_rates","note":"Up from 45 cents."},
  {"p":"2014-01-26","v":49,"src":"usps_rates","note":"Up from 46 cents."},
  {"p":"2016-04-10","v":47,"src":"usps_rates","note":"Down from 49 cents."},
  {"p":"2017-01-22","v":49,"src":"usps_rates","note":"Up from 47 cents."},
  {"p":"2018-01-21","v":50,"src":"usps_rates","note":"Up from 49 cents."},
  {"p":"2019-01-27","v":55,"src":"usps_rates","note":"Up from 50 cents."},
  {"p":"2021-08-29","v":58,"src":"usps_rates","note":"Up from 55 cents."},
  {"p":"2022-07-10","v":60,"src":"usps_rates","note":"Up from 58 cents."},
  {"p":"2023-01-22","v":63,"src":"usps_rates","note":"Up from 60 cents."},
  {"p":"2023-07-09","v":66,"src":"usps_rates","note":"Up from 63 cents."},
  {"p":"2024-01-21","v":68,"src":"usps_rates","note":"Up from 66 cents."},
  {"p":"2024-07-14","v":73,"src":"usps_rates","note":"Up from 68 cents."},
  {"p":"2025-07-13","v":78,"src":"usps_rates","note":"Up from 73 cents."},
  {"p":"2026-07-12","v":82,"src":"usps_rates","note":"Up from 78 cents."}
 ]},
"coke_nickel":{"label":"Price of a 6.5 oz bottle of Coca-Cola","unit":"US cents per 6.5 fl oz bottle","freq":"A","kind":"span","country":"US","group":"items","span":{"from":"1886","to":"1959"},"source":"Levy and Young, The Real Thing: Nominal Price Rigidity of the Nickel Coke, 1886-1959 (2004)","sourceId":"MPRA Paper 1046","url":"https://mpra.ub.uni-muenchen.de/1046/","licence":"Journal article; a single cited fact. Cite the paper.","retrieved":"2026-10-24","asOf":"1959","notes":"One documented fact, drawn as a span and not as a line of yearly values: the paper reports that a 6.5 oz Coke cost 5 cents from 1886 until 1959. The two points are the ends of that span, and nothing is known to have changed in between. Some other accounts give earlier end years, so label the span 'about 1886 to 1959' and cite the paper. There is no free documented dollar series for soft drinks between 1959 and 1980; BLS average prices start in 1980 (see price_cola_* in data/prices.js). The bottle size, the brand and the way it was sold differ from the BLS products, so the nickel is a reference point and not a base for an index.","breaks":[],"data":[
  {"p":"1886","v":5,"src":"levy_young_2004","note":"Start of the documented 5 cent price for a 6.5 oz bottle."},
  {"p":"1959","v":5,"src":"levy_young_2004","note":"End of the documented 5 cent price; the paper's span is 1886 to 1959."}
 ]},
"bread_1913":{"label":"Bread, per lb, January 1913","unit":"USD per lb","freq":"M","kind":"point","country":"US","group":"items","compareWith":"price_bread","source":"U.S. Bureau of Labor Statistics, Beyond the Numbers, Table 1","sourceId":"Bread","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","licence":"Public domain (US government work). Cite BLS.","retrieved":"2026-10-24","asOf":"1913-01","notes":"One anchor from BLS's own comparison of January 1913 and January 2013 prices. In the same table the January 2013 figure (1.422 dollars) equals price_bread for 2013-01. Indicative only: the product definition behind the 1913 figure is not the same as the modern average price series.","breaks":[],"data":[
  {"p":"1913-01","v":0.056,"src":"bls_btn_2013","note":"Table 1, January 1913 column. Indicative only."}
 ]},
"eggs_1913":{"label":"Eggs, per dozen, January 1913","unit":"USD per dozen","freq":"M","kind":"point","country":"US","group":"items","compareWith":"price_eggs","source":"U.S. Bureau of Labor Statistics, Beyond the Numbers, Table 1","sourceId":"Eggs, per dozen","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","licence":"Public domain (US government work). Cite BLS.","retrieved":"2026-10-24","asOf":"1913-01","notes":"One anchor from BLS's own comparison of January 1913 and January 2013 prices. In the same table the January 2013 figure (1.933 dollars) equals price_eggs for 2013-01. Indicative only: the table does not state an egg grade or size for 1913, and the modern series is grade A large.","breaks":[],"data":[
  {"p":"1913-01","v":0.373,"src":"bls_btn_2013","note":"Table 1, January 1913 column. Grade and size not stated for 1913."}
 ]},
"milk_1913":{"label":"Milk, per gallon, January 1913","unit":"USD per gallon","freq":"M","kind":"point","country":"US","group":"items","compareWith":"price_milk","source":"U.S. Bureau of Labor Statistics, Beyond the Numbers, Table 1","sourceId":"Fresh milk, per gallon","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","licence":"Public domain (US government work). Cite BLS.","retrieved":"2026-10-24","asOf":"1913-01","notes":"BLS recorded milk per quart in 1913 (0.089 dollars) and converted it to 0.356 dollars per gallon. The modern series is whole, fortified milk, and the January 2013 figure in the same table (3.526 dollars) equals price_milk for 2013-01. Indicative only.","breaks":[],"data":[
  {"p":"1913-01","v":0.356,"src":"bls_btn_2013","note":"Table 1, January 1913 column. Recorded as 0.089 dollars per quart and converted to a gallon by BLS."}
 ]},
"coffee_1913":{"label":"Coffee, per lb, January 1913","unit":"USD per lb","freq":"M","kind":"point","country":"US","group":"items","compareWith":"price_coffee","source":"U.S. Bureau of Labor Statistics, Beyond the Numbers, Table 1","sourceId":"Coffee","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","licence":"Public domain (US government work). Cite BLS.","retrieved":"2026-10-24","asOf":"1913-01","notes":"One anchor from BLS's own comparison of January 1913 and January 2013 prices. In the same table the January 2013 figure (5.902 dollars) equals price_coffee for 2013-01. Indicative only: the table does not say which form of coffee was priced in 1913, and the modern series is 100% ground roast.","breaks":[],"data":[
  {"p":"1913-01","v":0.299,"src":"bls_btn_2013","note":"Table 1, January 1913 column. Form of coffee not stated for 1913."}
 ]},
"sugar_1913":{"label":"Sugar, per lb, January 1913","unit":"USD per lb","freq":"M","kind":"point","country":"US","group":"items","compareWith":"price_sugar","source":"U.S. Bureau of Labor Statistics, Beyond the Numbers, Table 1","sourceId":"Sugar","url":"https://www.bls.gov/opub/btn/volume-2/average-food-prices-a-snapshot-of-how-much-has-changed-over-a-century.htm","licence":"Public domain (US government work). Cite BLS.","retrieved":"2026-10-24","asOf":"1913-01","notes":"One anchor from BLS's own comparison of January 1913 and January 2013 prices. In the same table the January 2013 figure (0.683 dollars) equals price_sugar for 2013-01. Indicative only.","breaks":[],"data":[
  {"p":"1913-01","v":0.058,"src":"bls_btn_2013","note":"Table 1, January 1913 column. Indicative only."}
 ]},
"farmland_acre_points":{"label":"Farm real estate value per acre, selected years (fallback for farmland_acre)","unit":"USD per acre","freq":"A","kind":"points","country":"US","group":"land","fallbackFor":"farmland_acre","proxy":true,"source":"USDA National Agricultural Statistics Service, Quick Stats, survey, national","sourceId":"AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE","url":"https://www.nass.usda.gov/datasets/","licence":"US federal agency data; treated as public domain. Cite USDA NASS.","retrieved":"2026-10-24","asOf":"2026","notes":"Selected points from the same NASS series the fetcher reads in full (data/prices.js, farmland_acre); use these only when that series is missing. A proxy for land value: farmland including farm buildings, not residential land. Spacing is irregular on purpose.","breaks":[],"data":[
  {"p":"1850","v":11,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1900","v":20,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1913","v":43,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1933","v":30,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1950","v":65,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1971","v":203,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1980","v":737,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"1990","v":683,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"2000","v":1090,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"2010","v":2150,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"2020","v":3130,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"2025","v":4350,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."},
  {"p":"2026","v":4500,"src":"nass_quickstats","note":"Survey estimate of farm real estate, land with buildings; equals farmland_acre for this year."}
 ]},
"land_resid_acre_points":{"label":"Residential land value per acre, 2012 and 2022 (fallback for land_resid_acre)","unit":"USD per acre","freq":"A","kind":"points","country":"US","group":"land","fallbackFor":"land_resid_acre","proxy":true,"source":"Federal Housing Finance Agency, The Price of Residential Land (v4.0, June 2024), national","sourceId":"Panel Nation, per acre as-is","url":"https://www.fhfa.gov/document/land-prices_2024_20_june.xlsx","licence":"US federal agency product; treated as public domain. Cite FHFA.","retrieved":"2026-10-24","asOf":"2022","notes":"The two end points of the only national residential land price series found: 2012 to 2022. Partial and experimental; FHFA says the estimates are subject to change. Use only when land_resid_acre is missing from data/prices.js.","breaks":[],"data":[
  {"p":"2012","v":416600,"src":"fhfa_land","note":"Experimental estimate, all single-family parcels, per acre as-is; equals land_resid_acre for this year."},
  {"p":"2022","v":934900,"src":"fhfa_land","note":"Experimental estimate, all single-family parcels, per acre as-is; equals land_resid_acre for this year."}
 ]}
}
};
