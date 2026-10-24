// Curated figures for the Money Flow page (window.MONEY_FLOW). Edit by hand.
// Fact-checked 2026-10-23. Money amounts are USD billions unless a field says otherwise.
//
// asOf strings use the precision of the source: YYYY-MM-DD, YYYY-MM, YYYY-Qn, YYYY-Hn or YYYY.
//
// Money supply is not stored here. A magnitudes row with a derive rule has valueBn and asOf set to null
// and the page fills them from window.MONEY_SUPPLY (data/money-supply.js):
//   "ms:<seriesId>"            latest row with a non-null USD value (column index 2) of that series;
//                              asOf is that row's period (for example "2026-08")
//   "ms:sum(<id>,<id>,...)"    sum of those latest USD values; asOf is "<earliest period> to <latest period>"
// On derived rows source and url are fallbacks; the page may replace them with the series' own
// source and url. A url may be a relative page link on derived rows.
//
// reserveRequirements: ratio is a fraction of deposits (0.01 = 1%); ratioText is the label to show.
// magnitudes: partOf names the id of a row this one sits inside (null if none). Rows overlap and are not additive.
//   Rows of type cb-assets repeat the matching centralBanks entry.
// centralBanks: local is a text with the local-currency amount and the FX rate used for assetsBn.
// gdp: economy "ea" is the euro-area aggregate. It overlaps Germany, France and Italy, so use it for
//   ratios and keep it out of country rankings.
// debt: the basis differs by economy and is stated in each row, so rows are not like for like.
//   ofGdp (optional text) is the debt to GDP ratio as published for the same basis and period. The page never divides a
//   debt stock by GDP of another year, so a row without ofGdp shows no ratio.
// moneyRows: seriesId names a MONEY_SUPPLY series; the headline aggregate comes first for each economy.
//   The India row has seriesId null and carries its own valueBn, local, asOf, source and url.
window.MONEY_FLOW = {
  asOf: "2026-10-23",

  reserveRequirements: [
    {
      cb: "Federal Reserve", ratio: 0, ratioText: "0%", since: "2020-03-26",
      note: "Announced 15 Mar 2020 and effective 26 Mar 2020 for all depository institutions. Before that the ratios were 0%, 3% and 10% in tiers on net transaction accounts only, so 10% of all deposits never applied. In the ample-reserves regime in place since Jan 2019 requirements do not play a significant role.",
      source: "Federal Reserve Board, Reserve Requirements",
      url: "https://www.federalreserve.gov/monetarypolicy/reservereq.htm"
    },
    {
      cb: "European Central Bank", ratio: 0.01, ratioText: "1%", since: "2012-01-18",
      note: "1% on overnight deposits, deposits up to 2 years and debt securities up to 2 years; 0% on longer liabilities. It was 2% from 1999. In the maintenance period 29 Jul to 15 Sep 2026 the average requirement was EUR 174.7bn against current-account holdings of EUR 338.0bn (excess EUR 163.3bn), remunerated at 0%.",
      source: "ECB, how to calculate the minimum reserve requirements; ECB, Minimum reserves",
      url: "https://www.ecb.europa.eu/mopo/implement/mr/html/calc.en.html"
    },
    {
      cb: "Bank of England", ratio: 0, ratioText: "None", since: "n/a",
      note: "No reserve requirement. Banks choose their own reserve balance, which is remunerated at Bank Rate.",
      source: "Bank of England, Andrew Bailey, LSE lecture, May 2024",
      url: "https://www.bankofengland.co.uk/speech/2024/may/andrew-bailey-lecture-london-school-of-economics-charles-goodhart"
    },
    {
      cb: "Bank of Japan", ratio: 0.008, ratioText: "0.05% to 1.3% (avg about 0.8%)", since: "1991-10-16",
      note: "Statutory ratios run from 0.05% to 1.3% by deposit type and balance tier (schedule effective 16 Oct 1991). The average effective ratio of about 0.8% is a secondary estimate (CEIC), not a Bank of Japan figure.",
      source: "Bank of Japan, Reserve Requirement Ratios; average from CEIC (secondary)",
      url: "https://www.boj.or.jp/en/statistics/boj/other/reservereq/junbi.htm"
    },
    {
      cb: "People's Bank of China", ratio: 0.063, ratioText: "about 6.3% (average)", since: "2025-05-15",
      note: "Average ratio stated by Deputy Governor Zou Lan in Jan 2026. The last confirmed cut (0.5 point) took effect 15 May 2025 and no 2026 cut was found. The one major central bank still using the ratio as an active, often-cut tool, alongside window guidance and credit targets. Trading Economics shows 7.50% for Sep 2026 on an unclear definition, so treat it with caution.",
      source: "Yicai Global, reporting PBoC Deputy Governor Zou Lan (Jan 2026; secondary)",
      url: "https://www2.yicaiglobal.com/news/chinas-central-bank-lowers-relending-rates-sees-room-for-rrr-cuts"
    }
  ],

  magnitudes: [
    // Notional
    {
      id: "otc-derivatives", label: "OTC derivatives, notional outstanding", valueBn: 844578, type: "notional",
      asOf: "2025-12-31", source: "BIS OTC derivatives statistics (WS_OTC_DERIV2), all risk categories, 2025-S2",
      url: "https://data.bis.org/topics/OTC_DER", partOf: null,
      note: "A reference amount, not a claim and not money at risk. Part of the rise from 699,476 at end-2024 reflects a broader reporting base. Netting cuts exposure by about 85% (ISDA)."
    },

    // Debt
    {
      id: "global-debt-iif", label: "Global debt, IIF perimeter", valueBn: 365000, type: "debt",
      asOf: "2026-H1", source: "Institute of International Finance, Global Debt Monitor H1 2026 (reported as more than 365T)",
      url: "https://www.iif.com/Products/Global-Debt-Monitor", partOf: null,
      note: "About 310% of world GDP. A wider perimeter than the IMF figure (it includes the financial sector), so the two rows are not nested."
    },
    {
      id: "global-debt-imf", label: "Global debt, IMF perimeter", valueBn: 251000, type: "debt",
      asOf: "2024", source: "IMF Global Debt Database, 2025 update (blog of 17 Sep 2025)",
      url: "https://www.imf.org/en/Blogs/Articles/2025/09/17/global-debt-remains-above-235-of-world-gdp", partOf: null,
      note: "Just above 235% of 2024 world GDP. No 2026 vintage of the database was found. The next two rows are its public and private parts."
    },
    {
      id: "global-public-debt", label: "Global public debt", valueBn: 99200, type: "debt",
      asOf: "2024", source: "IMF Global Debt Database, 2025 update (blog of 17 Sep 2025)",
      url: "https://www.imf.org/en/Blogs/Articles/2025/09/17/global-debt-remains-above-235-of-world-gdp", partOf: "global-debt-imf",
      note: "Nearly 93% of world GDP."
    },
    {
      id: "global-private-debt", label: "Global private debt", valueBn: 151800, type: "debt",
      asOf: "2024", source: "IMF Global Debt Database, 2025 update (blog of 17 Sep 2025)",
      url: "https://www.imf.org/en/Blogs/Articles/2025/09/17/global-debt-remains-above-235-of-world-gdp", partOf: "global-debt-imf",
      note: "Under 143% of world GDP."
    },
    {
      id: "us-federal-debt", label: "US federal debt", valueBn: 40413.6, type: "debt",
      asOf: "2026-10-21", source: "US Treasury Fiscal Data, Debt to the Penny (total public debt outstanding)",
      url: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/", partOf: "global-public-debt",
      note: "Includes intragovernmental holdings, and the date is two years after the IMF figure, so the nesting inside global public debt is approximate."
    },

    // Money (derived rows read MONEY_SUPPLY at load)
    {
      id: "global-broad-money", label: "Global broad money", valueBn: 151500, type: "money",
      asOf: "2024", source: "World Bank WDI: broad money 135.7% of GDP (FM.LBL.BMNY.GD.ZS) times world GDP (NY.GDP.MKTP.CD)",
      url: "https://data.worldbank.org/indicator/FM.LBL.BMNY.GD.ZS?locations=1W", partOf: null,
      note: "Derived from two World Bank series (135.66% of 111,669bn). No central bank publishes a world total. Aggregator estimates put mid-2026 near 150,000 (KuCoin and CryptoBriefing, Jun 2026), which agrees but has no primary source."
    },
    {
      id: "broad-money-5-economies", label: "Broad money, five economies", valueBn: null, type: "money",
      asOf: null, source: "Sum of the latest USD values of the five rows below",
      url: "monetary-history.html", partOf: "global-broad-money", derive: "ms:sum(us_m2,ea_m2,uk_m4,jp_m2,cn_m2)",
      note: "US, euro area, Japan and China at M2, UK at M4 (the UK headline M4ex is lower). Each series is converted at its own month-end FX, and definitions differ, so read it as an order of magnitude. Using M3 for the euro area and Japan gives a higher sum."
    },
    {
      id: "ms-cn-m2", label: "China M2", valueBn: null, type: "money",
      asOf: null, source: "PBoC M2 via EastMoney's unofficial mirror",
      url: "monetary-history.html", partOf: "broad-money-5-economies", derive: "ms:cn_m2",
      note: "Verify against pbc.gov.cn for anything published."
    },
    {
      id: "ms-us-m2", label: "US M2", valueBn: null, type: "money",
      asOf: null, source: "Federal Reserve H.6",
      url: "monetary-history.html", partOf: "broad-money-5-economies", derive: "ms:us_m2",
      note: "Seasonally adjusted, monthly average of daily levels."
    },
    {
      id: "ms-ea-m2", label: "Euro area M2", valueBn: null, type: "money",
      asOf: null, source: "ECB Data Portal, BSI dataset",
      url: "monetary-history.html", partOf: "broad-money-5-economies", derive: "ms:ea_m2",
      note: "Euro area, not the EU. The latest ECB observation is provisional."
    },
    {
      id: "ms-jp-m2", label: "Japan M2", valueBn: null, type: "money",
      asOf: null, source: "Bank of Japan Time-Series Data Search",
      url: "monetary-history.html", partOf: "broad-money-5-economies", derive: "ms:jp_m2",
      note: "The Bank of Japan headline is M3, which is larger."
    },
    {
      id: "ms-uk-m4", label: "UK M4", valueBn: null, type: "money",
      asOf: null, source: "Bank of England IADB LPMVUBR",
      url: "monetary-history.html", partOf: "broad-money-5-economies", derive: "ms:uk_m4",
      note: "The UK publishes no M2. M4 includes intermediate other financial corporations; the Bank headline M4ex excludes them."
    },

    // Flow per year
    {
      id: "world-gdp", label: "World GDP, per year", valueBn: 118350.2, type: "flow",
      asOf: "2025", source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)",
      url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=1W", partOf: null,
      note: "A flow over one year, not a stock. The IMF October 2026 projection for 2026 is about 128,004 (read from a secondary source, not checked on imf.org)."
    },

    // Market value
    {
      id: "otc-derivatives-gmv", label: "OTC derivatives, gross market value", valueBn: 22802, type: "market",
      asOf: "2025-12-31", source: "BIS OTC derivatives statistics (WS_OTC_DERIV2), gross market values, all risk categories, 2025-S2",
      url: "https://data.bis.org/topics/OTC_DER", partOf: "otc-derivatives",
      note: "The claim-like measure of the notional amount above."
    },
    {
      id: "gold-above-ground", label: "Gold, all above ground", valueBn: 28850, type: "market",
      asOf: "2026-10-23", source: "World Gold Council, above-ground stock of 222,600 t (end-Q2 2026), times spot gold of $4,031.90 per oz (gold-api.com)",
      url: "https://www.gold.org/goldhub/data/how-much-gold", partOf: null,
      note: "Tonnes times spot, about 28,850, so it moves with the gold price. The World Gold Council's own end-Q2 2026 value is 29.0tn."
    },
    {
      id: "gold-official", label: "Gold, official sector", valueBn: 5060, type: "market",
      asOf: "2026-10-23", source: "World Gold Council, central banks about 39,000 t (end-Q2 2026), times spot gold of $4,031.90 per oz (gold-api.com)",
      url: "https://www.gold.org/goldhub/data/how-much-gold", partOf: "gold-above-ground",
      note: "About 5,060 at spot; the World Gold Council shows 5.0tn at its end-Q2 price. Also counted inside central-bank assets (the Eurosystem alone holds EUR 1,286bn of gold)."
    },
    {
      id: "crypto", label: "Crypto market cap", valueBn: 2758.1, type: "market",
      asOf: "2026-10-23", source: "CoinGecko global data, total market cap",
      url: "https://www.coingecko.com/en/global-charts", partOf: null,
      note: "Bitcoin 1,642.3bn (59.5% of the total, recomputed from the two figures here), Ether 293.2bn. A live value that moves all day."
    },
    {
      id: "stablecoins", label: "Stablecoins", valueBn: 297.7, type: "market",
      asOf: "2026-10-23", source: "CoinGecko, Stablecoins category market cap",
      url: "https://www.coingecko.com/en/categories/stablecoins", partOf: "crypto",
      note: "About 10.8% of the total crypto market cap."
    },

    // Central-bank assets (repeat centralBanks)
    {
      id: "cb-pboc", label: "PBoC total assets", valueBn: 7533, type: "cb-assets",
      asOf: "2026-09", source: "Trading Economics, quoting the PBoC (secondary; PBoC release not checked)",
      url: "https://tradingeconomics.com/china/central-bank-balance-sheet", partOf: null,
      note: "Partly mirrors base money (liabilities) and government debt held. Verify on pbc.gov.cn."
    },
    {
      id: "cb-fed", label: "Federal Reserve total assets", valueBn: 6753.6, type: "cb-assets",
      asOf: "2026-10-21", source: "Federal Reserve H.4.1, total assets",
      url: "https://www.federalreserve.gov/releases/h41/", partOf: null,
      note: "Partly mirrors base money (liabilities) and government debt held (Treasuries)."
    },
    {
      id: "cb-ecb", label: "Eurosystem total assets", valueBn: 6679, type: "cb-assets",
      asOf: "2026-10-16", source: "ECB, consolidated financial statement of the Eurosystem (EUR 5,935.3bn at EURUSD 1.1253)",
      url: "https://www.ecb.europa.eu/press/annual-reports-financial-statements/wfs/2026/html/ecb.fst261020.en.html", partOf: null,
      note: "Partly mirrors base money (liabilities) and government debt held. Includes gold and gold receivables of EUR 1,286.2bn."
    },
    {
      id: "cb-boj", label: "Bank of Japan total assets", valueBn: 3983, type: "cb-assets",
      asOf: "2026-09", source: "Bank of Japan Accounts, total assets (MABJMTA), JPY 625.03 trn at 156.91 per USD",
      url: "https://www.stat-search.boj.or.jp/index_en.html", partOf: null,
      note: "Partly mirrors base money (liabilities) and government debt held (about 49% of JGBs at Dec 2025)."
    },
    {
      id: "cb-boe", label: "Bank of England total assets", valueBn: 1099.6, type: "cb-assets",
      asOf: "2026-10-21", source: "Bank of England Weekly Report, 21 Oct 2026 (sum of listed lines, GBP 822.8bn at 1.3363)",
      url: "https://www.bankofengland.co.uk/weekly-report/2026/21-october-2026", partOf: null,
      note: "Partly mirrors base money (liabilities) and government debt held. The report shows no official total; this adds its sterling asset lines and foreign currency reserve assets."
    }
  ],

  centralBanks: [
    {
      id: "fed", name: "Federal Reserve", economy: "us", assetsBn: 6753.6, local: "USD 6,753.6bn",
      asOf: "2026-10-21", source: "Federal Reserve H.4.1, total assets",
      url: "https://www.federalreserve.gov/releases/h41/",
      note: "Peak about 8.97tn on 13 Apr 2022. Quantitative tightening ended 1 Dec 2025 and assets are 164bn above a year earlier. The monetary base (charted on Money Over Time) is a different quantity."
    },
    {
      id: "ecb", name: "ECB / Eurosystem", economy: "ea", assetsBn: 6679, local: "EUR 5,935.3bn at EURUSD 1.1253",
      asOf: "2026-10-16", source: "ECB, consolidated financial statement of the Eurosystem",
      url: "https://www.ecb.europa.eu/press/annual-reports-financial-statements/wfs/2026/html/ecb.fst261020.en.html",
      note: "Gold and gold receivables are EUR 1,286.2bn of the total. Euro-area banknotes in circulation are only part of the liabilities."
    },
    {
      id: "pboc", name: "PBoC", economy: "cn", assetsBn: 7533, local: "CNY 50.50 trn at 6.7045 per USD",
      asOf: "2026-09", source: "Trading Economics, quoting the PBoC (secondary; PBoC release not checked)",
      url: "https://tradingeconomics.com/china/central-bank-balance-sheet",
      note: "Secondary source: verify on pbc.gov.cn. August 2026 was CNY 49.86 trn. PBoC M0 (currency in circulation, charted on Money Over Time) is only part of the liabilities."
    },
    {
      id: "boj", name: "Bank of Japan", economy: "jp", assetsBn: 3983, local: "JPY 625.03 trn at 156.91 per USD",
      asOf: "2026-09", source: "Bank of Japan Accounts, total assets (MABJMTA), Time-Series Data Search",
      url: "https://www.stat-search.boj.or.jp/index_en.html",
      note: "Owns about 49.0% of JGBs at Dec 2025 (MOF and BoJ flow of funds), down from 50.0% at Sep 2025 and a 50.4% peak in 2024. The monetary base (charted on Money Over Time) is a different quantity."
    },
    {
      id: "boe", name: "Bank of England", economy: "uk", assetsBn: 1099.6, local: "GBP 822.8bn at 1.3363 per GBP",
      asOf: "2026-10-21", source: "Bank of England Weekly Report, 21 Oct 2026 (sum of listed lines)",
      url: "https://www.bankofengland.co.uk/weekly-report/2026/21-october-2026",
      note: "About GBP 820bn: short-term repo, long-term repo, TFSME, bond holdings and the Asset Purchase Facility loan, plus foreign currency reserve assets. The report shows no official total. Nationalised 1946."
    }
  ],

  banks: [
    {
      name: "ICBC", country: "China", assetsBn: 7608.4, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "Agricultural Bank of China", country: "China", assetsBn: 6940.7, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (stock-exchange filing)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "China Construction Bank", country: "China", assetsBn: 6492.1, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "Bank of China", country: "China", assetsBn: 5457.3, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "JPMorgan Chase", country: "United States", assetsBn: 4424.9, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (SEC filing)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "Bank of America", country: "United States", assetsBn: 3411.7, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (SEC filing)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "BNP Paribas", country: "France", assetsBn: 3281.8, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report); ranks 7 to 10 vary by ranking site",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "HSBC Holdings", country: "United Kingdom", assetsBn: 3233.0, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report); ranks 7 to 10 vary by ranking site",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "Cr\u00e9dit Agricole Group", country: "France", assetsBn: 3151.3, asOf: "2025-12-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report, group perimeter; other rankings show a lower figure)",
      url: "https://www.theglobalbanker.com/rankings/"
    },
    {
      name: "Mitsubishi UFJ Financial Group", country: "Japan", assetsBn: 2704.6, asOf: "2026-03-31",
      source: "The Global Banker, World's 100 largest banks 2026 (company report, fiscal year to Mar 2026); Postal Savings Bank of China (2,657.9) and Citigroup (2,657.2) are just below",
      url: "https://www.theglobalbanker.com/rankings/"
    }
  ],

  gdp: [
    { economy: "us", name: "United States", gdpBn: 30769.7, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=US" },
    { economy: "cn", name: "China", gdpBn: 19498.0, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=CN" },
    { economy: "de", name: "Germany", gdpBn: 5050.9, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=DE" },
    { economy: "jp", name: "Japan", gdpBn: 4435.2, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=JP" },
    { economy: "uk", name: "United Kingdom", gdpBn: 4002.6, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=GB" },
    { economy: "in", name: "India", gdpBn: 3956.1, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=IN" },
    { economy: "fr", name: "France", gdpBn: 3366.3, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=FR" },
    { economy: "ru", name: "Russia", gdpBn: 2561.3, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=RU" },
    { economy: "it", name: "Italy", gdpBn: 2551.6, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=IT" },
    { economy: "ca", name: "Canada", gdpBn: 2319.9, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$ (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=CA" },
    { economy: "ea", name: "Euro area (aggregate)", gdpBn: 18010.0, year: 2025, source: "World Bank WDI NY.GDP.MKTP.CD, current US$, euro area aggregate (updated 2026-10-08)", url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=XC" }
  ],

  debt: [
    {
      economy: "us", name: "United States", debtBn: 40413.6,
      basis: "Total public debt outstanding, federal gross: held by the public 32,566.3bn plus intragovernmental holdings 7,847.3bn. FY2026 gross interest expense 1,360.4bn (not net interest outlays); debt grew about 6.9bn a day on average in FY2026.",
      ofGdp: "about 124% of Q2 2026 GDP (IIF: 122.3%)",
      asOf: "2026-10-21", source: "US Treasury Fiscal Data, Debt to the Penny and interest expense",
      url: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/"
    },
    {
      economy: "cn", name: "China", debtBn: 19300,
      basis: "General government gross debt, from the IMF World Economic Outlook (October 2026 edition): 99.2% of 2025 GDP. The IMF figure was read from a secondary source and not checked on imf.org. The official central plus local government figure is CNY 96 trn, about 13,900bn.",
      ofGdp: "99.2% of 2025 GDP (IMF)",
      asOf: "2025", source: "IMF World Economic Outlook, general government gross debt (secondary read)",
      url: "https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO/CHN"
    },
    {
      economy: "ea", name: "Euro area", debtBn: 16180,
      basis: "General government gross debt, EUR 14,438.1bn (88.8% of GDP, EA21), converted at EURUSD 1.1205 on 23 Oct 2026. At the 30 Jun 2026 rate of 1.1394 it is about 16,450bn.",
      ofGdp: "88.8% of GDP (Eurostat, Q2 2026)",
      asOf: "2026-Q2", source: "Eurostat, quarterly government debt (gov_10q_ggdebt)",
      url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10q_ggdebt/default/table"
    },
    {
      economy: "jp", name: "Japan", debtBn: 8583,
      basis: "Central government debt (MOF): bonds, T-bills and borrowings, JPY 1,346.7 trn, converted at 156.91 per USD (Sep 2026 month-end). Not general government; the IMF gross figure is far higher as a share of GDP.",
      asOf: "2026-06-30", source: "Japan Ministry of Finance, Central Government Debt (as of 30 Jun 2026)",
      url: "https://www.mof.go.jp/english/policy/jgbs/reference/gbb/e202606.html"
    },
    {
      economy: "uk", name: "United Kingdom", debtBn: 4016,
      basis: "Public sector net debt (net, not gross), GBP 3,005.0bn provisional (94.0% of GDP, excluding banks classified to the public sector), converted at GBPUSD 1.3363. May be revised.",
      ofGdp: "94.0% of GDP (ONS, Sep 2026)",
      asOf: "2026-09-30", source: "ONS, Public sector finances, September 2026 (published 21 Oct 2026)",
      url: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/september2026"
    },
    {
      economy: "in", name: "India", debtBn: 3330,
      basis: "General government gross debt, IMF 84.1% of 2025 GDP (secondary read, as for China). Central government alone is INR 201.17 lakh crore (31 Mar 2026, provisional), about 2,120bn at 94.8 INR per USD.",
      ofGdp: "84.1% of 2025 GDP (IMF)",
      asOf: "2025", source: "IMF World Economic Outlook, general government gross debt (secondary read)",
      url: "https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO/IND"
    }
  ],

  moneyRows: [
    { economy: "us", name: "United States", seriesId: "us_m2", label: "US M2", note: "Headline aggregate. Seasonally adjusted, monthly average of daily levels. The ratio to GDP divides a 2026 money stock at month-end FX by 2025 GDP at annual-average FX, so it can differ by several points from a same-period local-currency ratio." },
    { economy: "ea", name: "Euro area", seriesId: "ea_m3", label: "Euro area M3", note: "ECB headline aggregate. Euro area, not the EU. The latest observation is provisional. Same GDP-ratio caveat as the US row." },
    { economy: "ea", name: "Euro area", seriesId: "ea_m2", label: "Euro area M2", note: "Narrower than M3. Same GDP-ratio caveat as the US row." },
    { economy: "uk", name: "United Kingdom", seriesId: "uk_m4ex", label: "UK M4ex", note: "Bank of England headline (M4 excluding intermediate other financial corporations). The UK publishes no M2. Same GDP-ratio caveat as the US row." },
    { economy: "jp", name: "Japan", seriesId: "jp_m3", label: "Japan M3", note: "Bank of Japan headline aggregate. Same GDP-ratio caveat as the US row." },
    { economy: "jp", name: "Japan", seriesId: "jp_m2", label: "Japan M2", note: "Narrower than M3. Same GDP-ratio caveat as the US row." },
    { economy: "cn", name: "China", seriesId: "cn_m2", label: "China M2", note: "PBoC M2 via EastMoney's unofficial mirror; verify against pbc.gov.cn. The GDP-ratio caveat bites hardest here: in Oct 2026 the USD-level ratio was about 19 points above a same-period yuan ratio (about 256%, CNY 359.63 trn over CNY 140.19 trn of GDP), because the yuan strengthened between the GDP year and the money date." },
    {
      economy: "in", name: "India", seriesId: null, label: "India M3",
      valueBn: 3150, local: "INR 299,035bn at about 94.8 INR per USD (ECB cross rate, 23 Oct 2026)",
      asOf: "2026-01-31", source: "Reserve Bank of India, SDDS analytical accounts of the banking sector (broad money M3)",
      url: "https://www.rbi.org.in/scripts/SDDSview.aspx",
      note: "Entered by hand, not part of the Money Over Time series. India's headline is M3, not M2. Last checked level is Jan 2026 (+12.0% y/y), so the current level is higher. Same GDP-ratio caveat as the US row."
    }
  ]
};
