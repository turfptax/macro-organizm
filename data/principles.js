/* Macro Organizm: principles, claims, strains and money systems for the Start page (window.PRINCIPLES). Edit by hand.
   Written 2026-10-24 against the data files of that date. ASCII only; no em dash.

   Numbers in text are {{placeholders}}: {{series.rule.arg.arg|fmt}}, resolved by assets/derive.js over data/debt.js,
   data/prices.js, data/history.js. A statement with cited: true quotes a published figure and carries no placeholder;
   it is labelled "published figure" on the page. Short series names live in aliases.

   Shape (every string may hold placeholders):
     version, asOf, title, scope, intro[]            page framing
     kinds{fact,trend,interpretation}, basis{computed,cited}    labels for statements and numbers
     verdicts{<word>: {shape, meaning}}              the fixed verdict set, shown as shape plus word
     windows[]                                       default price windows {id,label,start,end,note}
     aliases{}                                       short series names for placeholders
     walkthrough{title,intro,steps[],diagrams[]}     step {id,n,title,blocks[{kind,text,refs,cited?}],diagrams[]}
     claimsIntro{}, claims[]                         claim {id,n,claim,asked,quick?,verdict,verdictLine,text,right[],notRight[],
                                                      numbers[{label,ph,note?}],windows[table],picker?,disagree[],
                                                      objection[{against,text,refs}],change[],limits[],links[],refs[]}
                                                     table {id,title,note,columns[],rows[{label,cells[],benchmark?}]}
     fragilitiesIntro{}, fragilities[]               strain {id,n,name,why,metric,reading[{label,ph,note?}],readingNote?,
                                                      readingTable?,published[],counterpoint,leaves?,links[],refs[]}
     fragilitiesHeld{title,intro,items[]}            where the system has held: statements, shown after the ten strains
                                                     readingTable {title,note,columns[],rows[{label,cells[]}]}; published[]
                                                     and counterpoint are statements; projection: true marks a projection
     systems{title,intro,evidenceNote,readings[],caveats[],scoreboard{columns,rows[{system,cells[]}]},items[]}
                                                     item {id,name,period,status,evidence,created,matrix{},cases[],
                                                      outcomes[{label,value,period,scope,basis,refs}],strengths[],weaknesses[],refs[]}
     method{}, glossary[{term,def}]
     sources{<id>: {title,publisher,date,url,kind,retrieved,checked,note?}}  kind: primary, secondary, dataset, claim */
window.PRINCIPLES = {
  version: 1,
  asOf: "2026-10-24",
  title: "Money from first principles",
  scope: "This page tests claims; it does not score the system.",
  intro: [
    "Eight claims about money, debt and prices are tested here one at a time against data. Six are common criticisms of the system and two are made in its defence. For each claim the page says what is right, what is not, which numbers decide it, where economists still disagree, the strongest counterargument and what evidence would change the verdict. It does not rank money systems and it does not give a score.",
    "Every statement carries a label: an accounting fact (true by how balance sheets work), a measured trend (a number computed from a dataset, with its period and source) or an interpretation (an explanation or a judgment, which can be argued). A number marked as computed is calculated in your browser from the data files. A number marked as a published figure is quoted from the cited source and was not recomputed here."
  ],

  kinds: {
    fact: { word: "Accounting fact", gloss: "True by how balance sheets and definitions work. It does not depend on a dataset." },
    trend: { word: "Measured trend", gloss: "A pattern in data. The number, its period and its source are shown." },
    interpretation: { word: "Interpretation", gloss: "An explanation, a cause or a judgment. Reasonable people can disagree with it." }
  },
  basis: {
    computed: { word: "Computed here", gloss: "Calculated in your browser from the data files on this site; the period and the source are shown next to the number." },
    cited: { word: "Published figure", gloss: "Quoted from the cited source. This site did not recompute it, and the source is listed under Sources." }
  },

  // Verdicts come from a fixed set. The page shows shape plus word, never a colour alone.
  verdicts: {
    "Supported": { shape: "circle-filled", meaning: "The claim holds on the main measures in the countries and periods where the data are strongest. The card lists the limits: the periods, measures or countries where it does not hold." },
    "Partly supported": { shape: "circle-half", meaning: "Part of the claim holds and part does not, or the claim holds on some of the main measures but not on others." },
    "True in some windows": { shape: "square-half", meaning: "The claim describes some start dates well and others badly. The result depends on the dates chosen, so the card tests several windows side by side." },
    "Not supported": { shape: "circle-empty", meaning: "The evidence does not support the claim as stated. A narrower claim may still hold." },
    "Depends on definition": { shape: "diamond", meaning: "The answer turns on what the words in the claim mean or on a rule the claim leaves open." }
  },

  // The default windows for price questions. They are fixed in advance and always shown together. A doubling time within
  // 1.5 years of 17 counts as roughly 17 years, on this page and on the Prices page (assets/derive.js, PACE_TOLERANCE).
  windows: [
    { id: "w1913", label: "January 1913", start: "1913-01", end: "latest", note: "The first month of the CPI-U series." },
    { id: "w1971", label: "August 1971", start: "1971-08", end: "latest", note: "The month the gold window closed." },
    { id: "w1991", label: "September 1991", start: "1991-09", end: "latest", note: "A start date after the Great Inflation had ended." },
    { id: "w10y", label: "Latest 10 years", start: "latest-10y", end: "latest", note: "The ten years to the newest month." },
    { id: "w5y", label: "Latest 5 years", start: "latest-5y", end: "latest", note: "The five years to the newest month." },
    { id: "w2020", label: "February 2020", start: "2020-02", end: "latest", note: "The month before the 2020 shock, the start of the recent surge." }
  ],

  // Short names for series ids, used by {{placeholders}}. Defaults (cpi, pay, house, hpi, income, tbill, m2, gdp, gold, fedDebt) live in assets/derive.js.
  aliases: {
    usnetint: "debt:US_NETINT_BN:US",
    usrcpt: "debt:US_RECEIPTS_BN:US",
    usout: "debt:US_OUTLAYS_BN:US",
    usdebt: "debt:US_DEBT_TOTAL_USD:US",
    usgdpfy: "debt:US_GDP_FY_BN:US",
    usrate: "debt:US_AVG_RATE:US",
    usgross: "debt:US_DEBT_GROSS_GDP:US",
    uspublic: "debt:US_DEBT_PUBLIC_GDP:US",
    usie: "debt:ie:US",
    usd: "debt:d:US",
    usg: "debt:NGDP_GROWTH:US",
    uspb: "debt:pb:US",
    hhus: "debt:TC_HH:US",
    nfcus: "debt:TC_NFC:US",
    ggus: "debt:TC_GG:US",
    dsrhhus: "debt:DSR_HH:US",
    wus: "debt:GGXWDG_NGDP:US",
    wjp: "debt:GGXWDG_NGDP:JP",
    wgb: "debt:GGXWDG_NGDP:GB",
    wde: "debt:GGXWDG_NGDP:DE",
    wfr: "debt:GGXWDG_NGDP:FR",
    wit: "debt:GGXWDG_NGDP:IT",
    wca: "debt:GGXWDG_NGDP:CA",
    wcn: "debt:GGXWDG_NGDP:CN",
    fed: "hist:fedBalance",
    ukhouse: "uk_house_price",
    ukrpi: "uk_rpi",
    ukcpi: "uk_cpi",
    ukrpia: "uk_rpi_annual",
    ukpay: "uk_earnings_weekly",
    cahouse: "ca_nhpi_house",
    caland: "ca_nhpi_land",
    cacpi: "ca_cpi",
    shiller: "house_price_shiller",
    carb: "cpi_carbonated",
    soft12: "price_softdrinks_12pk_12oz"
  },
  // First-principles walkthrough. Each block is one labelled statement. cited: true means it quotes a published figure.
  // diagrams lists ids from walkthrough.diagrams (balance-sheet pictures; the amounts are symbolic, not data).
  walkthrough: {
    title: "How money works, from first principles",
    intro: "A plain-language walk through the system, with US figures unless stated. Ten steps, each labelled as an accounting fact, a measured trend or an interpretation.",
    steps: [
      {
        id: "step-1", n: 1, title: "What money is",
        diagrams: ["layers"],
        blocks: [
          { kind: "fact", text: "Money is a claim that everyone accepts for settling debts. Today it comes in three layers. Cash is a liability of the central bank. Reserves, the balances that commercial banks hold at the central bank, are also a liability of the central bank. Bank deposits are a liability of a commercial bank to the person who holds them.", refs: ["boe2014"] },
          { kind: "trend", cited: true, text: "In the UK, bank deposits are 97 percent of broad money in circulation and are mostly created by commercial banks themselves (Bank of England 2014). In the US, cash is about a tenth of M2: $2,389.7 billion of $23,342.8 billion in August 2026 (FRED series CURRSL and M2SL).", refs: ["boe2014", "fred_currsl", "fred_m2sl"] }
        ]
      },
      {
        id: "step-2", n: 2, title: "How deposits are created, and destroyed",
        diagrams: ["loan", "repay"],
        blocks: [
          { kind: "fact", text: "When a bank makes a loan it credits the borrower's account. A deposit (the borrower's asset, the bank's liability) and a loan (the borrower's debt, the bank's asset) appear at the same moment.", refs: ["boe2014", "bundesbank2017"] },
          { kind: "interpretation", text: "On the central-bank account, no earlier saving is needed and the bank is not lending out a deposit that already exists. Selgin (2024) argues that an individual bank must still find funding and reserves to settle the payments that follow, so the intermediary view is disputed (see claim 1).", refs: ["boe2014", "bundesbank2017", "selgin2024"] },
          { kind: "fact", text: "When the loan is repaid, the deposit and the debt both disappear. The borrower spends the new deposit, so the seller, not the borrower, ends up holding it. Nobody else's balance fell when the loan was made.", refs: ["boe2014"] },
          { kind: "trend", cited: true, text: "Destruction happens as well as creation: US M2 fell 4.8 percent between March 2022 ($21,788.1 billion) and October 2023 ($20,737.4 billion).", refs: ["fred_m2sl"] }
        ]
      },
      {
        id: "step-3", n: 3, title: "What limits it",
        diagrams: [],
        blocks: [
          { kind: "fact", text: "Bank profit and competition, capital and liquidity rules, whether households and firms want to borrow, and in the end the central bank's interest rate all limit how much money banks create.", refs: ["boe2014"] },
          { kind: "interpretation", text: "Credit demand and lender confidence rise and fall with the cycle, so the money stock follows the credit cycle. Models in which banks create money produce larger and faster lending swings than textbook models in which banks lend out existing savings.", refs: ["jakab_kumhof"] }
        ]
      },
      {
        id: "step-4", n: 4, title: "A second route that needs no private borrower",
        diagrams: ["purchase"],
        blocks: [
          { kind: "fact", text: "When a central bank buys government bonds, or when a government runs a deficit that banks or the central bank finance, new deposits and reserves appear with no private loan behind them and no private repayment that deletes them.", refs: ["boe2014"] },
          { kind: "trend", text: "The Federal Reserve's balance sheet was {{fed.value.2007|usdbn}} at the end of 2007, {{fed.value.2020|usdbn}} at the end of 2020, {{fed.value.2022|usdbn}} at the end of 2022 and {{fed.value.2025|usdbn}} at the end of 2025. As a share of US GDP it was {{fed.share.gdp.2000|p1}} in 2000, {{fed.share.gdp.2020|p1}} in 2020 and {{fed.share.gdp.2025|p1}} in 2025.", refs: ["money_history"] },
          { kind: "trend", cited: true, text: "US commercial-bank loans and leases were 97 percent of deposits on 2 January 2008, 76 percent on 25 December 2019, 60 percent on 2 March 2022 and 72 percent on 14 October 2026 (research calculation from FRED series TOTLL and DPSACBW027SBOG). The ratio fell until 2022 and has partly reversed since.", refs: ["fred_h8"] },
          { kind: "interpretation", text: "Between 2008 and 2022 loans backed a shrinking share of bank deposits and securities and reserves backed more, so 'money is debt' increasingly meant 'money is private debt plus public debt'. The ratio is a rough proxy, because deposits are also backed by private bonds and other assets, and since 2022 the shift has partly reversed.", refs: [] }
        ]
      },
      {
        id: "step-5", n: 5, title: "Interest",
        diagrams: [],
        blocks: [
          { kind: "fact", text: "A borrower owes principal plus interest. Interest is a payment from the borrower to the bank and is income to the bank. Debt service is a flow out of the borrower's income, not a draw on a fixed pile of money.", refs: [] },
          { kind: "interpretation", text: "Whether the interest returns to the economy depends on what the bank does with it. Wages, dividends and interest on deposits put it back into circulation, while retained earnings add to the bank's capital and do not. How much is paid out and how much retained is the open question behind the claim that interest is 'owed but never created' (see claim 1).", refs: ["binswanger2009", "jackson_victor2015"] },
          { kind: "interpretation", text: "What matters is debt service relative to income, and who holds the claims. Every debt is also somebody's asset, so gross debt overstates the net burden but says nothing about how it is distributed.", refs: [] },
          { kind: "trend", text: "The BIS estimate of US household debt service (scheduled interest and principal as a share of income) was {{dsrhhus.value.2007|p1}} in 2007, {{dsrhhus.value.2021|p1}} in 2021 and {{dsrhhus.value.2025|p1}} in 2025.", refs: ["bis_dsr"] }
        ]
      },
      {
        id: "step-6", n: 6, title: "Governments",
        diagrams: [],
        blocks: [
          { kind: "fact", text: "Governments finance deficits by selling bonds to banks, funds, foreigners and the central bank. The debt-to-GDP ratio changes each year by roughly (interest rate minus nominal growth rate) times the previous ratio, minus the primary surplus. If the interest rate is below nominal growth, a ratio can stay stable with some primary deficit. If it is above, the ratio snowballs.", refs: ["blanchard2019"] },
          { kind: "trend", text: "For the US in 2024, IMF data give an effective interest rate of {{usie.effrate.usd.usg.2024|p2}} (interest paid over the previous year's debt, adjusted for growth) against nominal GDP growth of {{usg.value.2024|p2}}: a gap of {{usie.rmg.usd.usg.2024|sgn2}} points. The primary balance was {{uspb.value.2024|sgn2}} points of GDP, and gross debt moved from {{usd.value.2023|p1}} of GDP in 2023 to {{usd.value.2024|p1}} in 2024, so the ratio can rise even when the interest rate is below growth.", refs: ["imf_pfmh"] }
        ]
      },
      {
        id: "step-7", n: 7, title: "Inflation",
        diagrams: [],
        blocks: [
          { kind: "interpretation", text: "Prices rise when spending grows faster than supply. Money growth matters most when it is large and sustained: across countries the link between money growth and inflation is strong when inflation is high and weak when inflation is low and velocity moves.", refs: ["mccandless_weber1995", "degrauwe_polan2005"] },
          { kind: "fact", text: "Prices double in about 70 divided by the annual inflation rate. A 17-year doubling needs {{calc.rate_for_doubling.17|p2}} a year, and inflation of two percent a year implies a doubling every {{calc.doubling_from_rate.2|yrs1}}.", refs: ["fed_inflation_goal"] },
          { kind: "trend", text: "US consumer prices doubled every {{cpi.doubling.1971-08.latest|yrs1}} from August 1971 to {{cpi.latestperiod}}. Other windows give different answers (see claim 3).", refs: ["bls_cpi"] }
        ]
      },
      {
        id: "step-8", n: 8, title: "Who gains from inflation",
        diagrams: [],
        blocks: [
          { kind: "fact", text: "Inflation that lenders did not expect moves purchasing power from holders of fixed nominal claims (cash, low-rate deposits, bonds) to issuers of fixed nominal debts (mortgage borrowers, firms and the government, the largest debtor).", refs: ["doepke_schneider2006"] },
          { kind: "interpretation", text: "Expected inflation is priced into interest rates (the Fisher effect), so the transfer comes mainly from surprises and from interest rates held below inflation. Claim 5 measures how complete that offset has been in the US sample. Savers can hold equities, indexed bonds or property, which tend to keep pace; many ordinary depositors do not. Doepke and Schneider find that the main US losers are rich, old bondholders and the main winners are young, middle-class households with fixed-rate mortgages, plus the government.", refs: ["doepke_schneider2006"] }
        ]
      },
      {
        id: "step-9", n: 9, title: "Why housing differs",
        diagrams: [],
        blocks: [
          { kind: "fact", text: "A household's borrowing power is its affordable monthly payment times an annuity factor, so at a given payment a lower mortgage rate supports a larger loan.", refs: ["knoll2017"] },
          { kind: "interpretation", text: "In a standard asset-pricing model a house is priced as a stream of housing services discounted at the interest rate, and land cannot be produced, so cheaper and more available credit lifts prices when supply is limited by land and law. This is a model, and claim 4 sets out the competing explanations.", refs: ["knoll2017"] },
          { kind: "trend", cited: true, text: "Per $1,000 of monthly payment on a 30-year loan the supportable loan is about $248,000 at a mortgage rate of 2.65 percent (7 January 2021, the record low), about $141,000 at 7.68 percent (the average of the weekly rates from April 1971 to October 2026) and about $146,000 at 7.32 percent (22 October 2026). The rates are Freddie Mac survey rates; the loan sizes are a research calculation. The 2021 low is the extreme, not the usual case.", refs: ["freddie_pmms"] },
          { kind: "trend", cited: true, text: "Knoll, Schularick and Steger find that about 80 percent of the rise in house prices from 1950 to 2012 across 14 economies is land value, with land-use regulation and rising demand for housing services cited as causes.", refs: ["knoll2017"] }
        ]
      },
      {
        id: "step-10", n: 10, title: "Putting it together",
        diagrams: [],
        blocks: [
          { kind: "interpretation", text: "The design is a trade-off. Credit money is elastic (supply expands with demand and with a central-bank backstop) and has a rule-like anchor (an inflation target). In exchange it ties the money stock to leverage and collateral, lets the price level drift up by design, favours debtors and asset owners over cash savers, and leaves the public backstop holding tail risk. The alternatives (gold, pegs, state-issued money) trade these weaknesses for other ones; the comparison of money systems below sets them side by side without ranking them.", refs: ["boe2014"] }
        ]
      }
    ],
    // Balance-sheet pictures. Amounts are symbolic (L is the size of the loan); nothing here is data.
    diagrams: [
      {
        id: "layers", title: "Three layers of money", note: "Each layer is somebody's liability to the holder.",
        layers: [
          { name: "Cash (notes and coins)", issuer: "Central bank", holder: "Households and firms" },
          { name: "Reserves", issuer: "Central bank", holder: "Commercial banks" },
          { name: "Bank deposits", issuer: "Commercial bank", holder: "Households and firms" }
        ]
      },
      {
        id: "loan", title: "A bank makes a loan",
        parties: [
          { name: "Bank", assets: ["+ Loan to the borrower (L)"], liabilities: ["+ Deposit of the borrower (L)"] },
          { name: "Borrower", assets: ["+ Deposit at the bank (L)"], liabilities: ["+ Loan owed to the bank (L)"] }
        ],
        result: "Deposits (money) and debt both rise by L. Nobody else's balance fell."
      },
      {
        id: "repay", title: "The loan is repaid",
        parties: [
          { name: "Bank", assets: ["- Loan to the borrower (L)"], liabilities: ["- Deposit of the borrower (L)"] },
          { name: "Borrower", assets: ["- Deposit at the bank (L)"], liabilities: ["- Loan owed to the bank (L)"] }
        ],
        result: "Deposits (money) and debt both fall by L. Repayment destroys the money that the loan created."
      },
      {
        id: "purchase", title: "A central bank buys a bond from an investor",
        parties: [
          { name: "Central bank", assets: ["+ Government bond (B)"], liabilities: ["+ Reserves of the investor's bank (B)"] },
          { name: "Investor's bank", assets: ["+ Reserves at the central bank (B)"], liabilities: ["+ Deposit of the investor (B)"] },
          { name: "Investor", assets: ["- Bond (B)", "+ Deposit (B)"], liabilities: [] }
        ],
        result: "Deposits and reserves both rise by B with no private loan behind them. The central bank now holds the bond."
      }
    ]
  },
  claimsIntro: {
    title: "Eight claims, tested",
    intro: "Each card states a claim in the spirit in which it is often made (claims 1 to 6 by critics of the system, claims 7 and 8 by its defenders), gives a verdict from a fixed set, and then sets out both sides: what is right, what is not, the numbers that decide it, where economists still disagree, the strongest counterargument and what would change the verdict. Verdicts are written by hand; the numbers they quote are computed from the data files. No card has the last word: each ends with an objection to its own verdict.",
    order: "The cards run from the mechanics of money (claims 1 and 2), through prices and house prices (claims 3 and 4), to who gains and loses (claim 5) and to alternatives (claim 6). Claims 7 and 8 test two propositions from the other side, about gold and about a two percent goal, with the same verdict set and the same numbers."
  },

  claims: [
    // ---------------------------------------------------------------- 1
    {
      id: "claim-1", n: 1,
      quick: "Private credit went from {{hhus.plus.nfcus.2008|p1}} to {{hhus.plus.nfcus.2025|p1}} of GDP (2008 to 2025); with government credit, from {{hhus.plus3.nfcus.ggus.2008|p1}} to {{hhus.plus3.nfcus.ggus.2025|p1}}.",
      claim: "Money is debt.",
      asked: "Almost all the money we use exists because someone borrowed it into existence, so the system needs ever more debt, and that is a flaw.",
      verdict: "Partly supported",
      verdictLine: "True of bank money as accounting. As a diagnosis it goes further than the evidence.",
      text: "Most modern money is a liability of a bank or of a central bank, and a bank loan creates a matching deposit, so as accounting for bank money the statement holds. Two things do not follow from it: that private loans are the only source of money, and that debt must grow without limit.",
      right: [
        { kind: "fact", text: "Every layer of money is somebody's liability to the holder: cash and reserves are liabilities of the central bank, deposits are liabilities of commercial banks. A loan creates a deposit and a debt at the same moment, and repayment removes both.", refs: ["boe2014", "bundesbank2017"] },
        { kind: "trend", cited: true, text: "The Bank of England puts bank deposits at 97 percent of broad money in circulation in the UK, mostly created by commercial banks themselves. The Bundesbank describes the process the same way for the euro area.", refs: ["boe2014", "bundesbank2017"] },
        { kind: "trend", text: "Private credit is large relative to output. US household plus corporate credit was {{hhus.plus.nfcus.1970|p1}} of GDP at the end of 1970, {{hhus.plus.nfcus.2000|p1}} at the end of 2000, {{hhus.plus.nfcus.2008|p1}} at the end of 2008 and {{hhus.plus.nfcus.2025|p1}} at the end of 2025.", refs: ["bis_tc"] },
        { kind: "trend", text: "Total non-financial credit, which adds government borrowing to household and company borrowing, was {{hhus.plus3.nfcus.ggus.1970|p1}} of GDP at the end of 1970, {{hhus.plus3.nfcus.ggus.2000|p1}} at the end of 2000, {{hhus.plus3.nfcus.ggus.2008|p1}} at the end of 2008 and {{hhus.plus3.nfcus.ggus.2025|p1}} at the end of 2025. It was higher at each of these four dates than at the one before, which is the 'ever more debt' reading.", refs: ["bis_tc"] },
        { kind: "interpretation", text: "Because lending creates money, the money stock rides the credit cycle. Models in which banks create money produce larger and faster lending swings than models in which banks lend out existing savings.", refs: ["jakab_kumhof"] }
      ],
      notRight: [
        { kind: "fact", text: "It describes balance sheets. Every debt is also someone's asset: a deposit is an asset of its holder and a liability of the bank.", refs: [] },
        { kind: "interpretation", text: "Whether this is a defect is a judgment, not an identity. Defenders say it describes how any credit economy works; critics say a money stock tied to lending is unstable. The objections below give both sides.", refs: ["jakab_kumhof", "schularick_taylor2012"] },
        { kind: "trend", text: "Not every unit of money has a private loan behind it. Central-bank purchases and government deficits create deposits and reserves with no private borrower. The Federal Reserve's balance sheet was {{fed.value.2007|usdbn}} at the end of 2007 and {{fed.value.2025|usdbn}} at the end of 2025, which is {{fed.share.gdp.2025|p1}} of GDP against {{fed.share.gdp.2000|p1}} in 2000.", refs: ["money_history"] },
        { kind: "trend", cited: true, text: "It is not unique to fiat money. In 17 advanced economies, private bank credit was about 50 to 60 percent of GDP around 1900 and stayed near that range into the 1970s, moving with broad money. It then rose from 62 percent in 1980 to 118 percent in 2010.", refs: ["jst2017"] },
        { kind: "interpretation", text: "The usual corollary, that interest is owed but never created so debt must outgrow money and the economy must grow forever, fails in its strong form. Interest paid to a bank is income to the bank and returns to circulation to the extent that it is paid out as wages, dividends and deposit interest rather than retained, and stationary economies with interest-bearing debt are logically possible. Private leverage has fallen since 2008: US household plus corporate credit went from {{hhus.plus.nfcus.2008|p1}} of GDP at the end of 2008 to {{hhus.plus.nfcus.2025|p1}} at the end of 2025, while M2 rose {{m2.ratio.2008.2025|x1}}.", refs: ["bis_tc", "money_history", "jackson_victor2015"] },
        { kind: "trend", text: "Total non-financial credit has not fallen. Government credit went from {{ggus.value.2008|p1}} of GDP at the end of 2008 to {{ggus.value.2025|p1}} at the end of 2025, a rise larger than the fall in private credit, so the total went from {{hhus.plus3.nfcus.ggus.2008|p1}} to {{hhus.plus3.nfcus.ggus.2025|p1}}. Debt moved onto the public balance sheet rather than shrinking, so the fall in private leverage is not evidence that total debt can stop growing. The point of Jackson and Victor, that a stationary economy with interest-bearing debt is logically possible, answers the logical claim, not this US record.", refs: ["bis_tc"] },
        { kind: "interpretation", text: "A weaker version survives. When debts are fixed in money terms, slow growth or falling prices make them heavier (Fisher 1933), and some economists argue that firm-level profit requires growth (Binswanger 2009). Others show that stationary economies with interest-bearing debt are logically possible (Jackson and Victor 2015).", refs: ["fisher1933", "binswanger2009", "jackson_victor2015"] }
      ],
      numbers: [
        { label: "US household plus corporate credit, % of GDP, end of 1970", ph: "{{hhus.plus.nfcus.1970|p1}}" },
        { label: "The same, end of 2000", ph: "{{hhus.plus.nfcus.2000|p1}}" },
        { label: "The same, end of 2008", ph: "{{hhus.plus.nfcus.2008|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.plus.nfcus.2025|p1}}" },
        { label: "US household credit, % of GDP, end of 2007", ph: "{{hhus.value.2007|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.value.2025|p1}}" },
        { label: "US government credit, % of GDP, end of 2008", ph: "{{ggus.value.2008|p1}}", note: "BIS nominal value" },
        { label: "US government credit, % of GDP, end of 2025", ph: "{{ggus.value.2025|p1}}", note: "BIS nominal value" },
        { label: "Household, company and government credit together, % of GDP, end of 1970", ph: "{{hhus.plus3.nfcus.ggus.1970|p1}}" },
        { label: "The same, end of 2000", ph: "{{hhus.plus3.nfcus.ggus.2000|p1}}" },
        { label: "The same, end of 2008", ph: "{{hhus.plus3.nfcus.ggus.2008|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.plus3.nfcus.ggus.2025|p1}}" },
        { label: "Federal Reserve total assets, end of 2007", ph: "{{fed.value.2007|usdbn}}" },
        { label: "The same, end of 2025", ph: "{{fed.value.2025|usdbn}}" },
        { label: "Federal Reserve assets, % of GDP, 2025", ph: "{{fed.share.gdp.2025|p1}}" },
        { label: "US M2, end of 2025", ph: "{{m2.value.2025|usdbn}}" }
      ],
      disagree: [
        { kind: "interpretation", text: "Whether banks are 'really' intermediaries. The central-bank view is that loans create deposits (Bank of England 2014). Selgin (2024) argues that banks must still fund themselves and hold liquidity against the deposits they create, so the intermediary view is not simply wrong.", refs: ["boe2014", "selgin2024"] },
        { kind: "interpretation", text: "Whether a growth imperative exists in an economy with interest-bearing debt. Binswanger (2009) argues yes at the firm level; Jackson and Victor (2015) and Cahen-Fourot and Lavoie (2016) argue it is not logically required.", refs: ["binswanger2009", "jackson_victor2015", "cahen_fourot2016"] }
      ],
      objection: [
        { against: "The 'misleading as a diagnosis' half of the verdict", text: "The same research cuts both ways. If banks create money by lending, the money stock and asset prices ride a procyclical credit cycle, and credit growth is the best-documented predictor of financial crises (Schularick and Taylor 2012). A money stock tied to leverage is a structural feature, not only a description. The growing share of public debt behind money means the system is leveraged on public as well as private balance sheets.", refs: ["schularick_taylor2012", "jakab_kumhof"] },
        { against: "The 'partly supported' verdict as too generous to the claim", text: "Endogenous money is a description, not a defect. Creation is bounded by capital rules, bank profit and borrower demand, and the elastic currency it provides is what the Federal Reserve was set up in 1913 to supply after recurrent panics. The leading structural alternative on paper, 100 percent reserve banking, is a model result published with an IMF disclaimer and never tested at scale.", refs: ["fedhist_act", "benes_kumhof2012"] }
      ],
      change: [
        "Toward Supported as a diagnosis: evidence that credit relative to GDP must keep rising for money and output to keep growing, for example a country where credit fell for a decade and money or output collapsed as a result.",
        "Toward Not supported even as accounting: evidence that banks cannot create deposits without first attracting savings, which would make the loan-creates-deposit description wrong.",
        "A rising share of deposits backed by public securities and reserves, rather than by private loans, would turn the claim into 'money is public debt', which is a different claim."
      ],
      limits: [
        "This card tests the accounting statement and its usual corollaries. It does not say whether the amount of debt is too high; the strains section looks at that.",
        "The Bank of England share, the loans-to-deposits ratios and the 1900-1970 credit range are published figures, not recomputed here.",
        "BIS annual values are fourth-quarter levels. The Federal Reserve and M2 series in the data file hold selected years, so the ratios are for the years named."
      ],
      links: [
        { label: "Money Flow: how loans create deposits and repayment destroys them", href: "money-flow.html" },
        { label: "Money Over Time: M2, GDP and the Federal Reserve balance sheet", href: "monetary-history.html#v=history&sh=usM2,usGDP,fedBalance" },
        { label: "Debt: credit by sector", href: "debt.html" }
      ],
      refs: ["boe2014", "bundesbank2017", "jakab_kumhof", "jst2017", "bis_tc", "money_history", "schularick_taylor2012", "selgin2024", "binswanger2009", "jackson_victor2015", "cahen_fourot2016", "fisher1933", "fedhist_act", "benes_kumhof2012"]
    },

    // ---------------------------------------------------------------- 2
    {
      id: "claim-2", n: 2,
      quick: "M2 grew {{m2.cagr.1971.2025|p2}} a year and nominal GDP {{gdp.cagr.1971.2025|p2}} (1971 to 2025); M2 was {{m2.share.gdp.1971|p1}} of GDP in 1971 and {{m2.share.gdp.2025|p1}} in 2025.",
      claim: "As M2 rises, our economy is not structured well.",
      asked: "The quantity of money keeps rising faster than the real economy, and that points to a structural weakness.",
      verdict: "Partly supported",
      verdictLine: "A rising M2 on its own is normal. Fast credit growth and the 2020-22 expansion are the better-supported concerns, though how far the 2021-22 inflation was monetary is contested.",
      text: "'Structured badly' is a judgment, so this card tests measurable proxies. A rising M2 level is expected in a growing economy with positive inflation, and the ratio of M2 to GDP has both fallen and risen. The better-supported concerns are fast credit growth and the 2020-22 expansion, which the research summarised here traces mostly to deficits and central-bank purchases rather than to loans (an inference, not a published decomposition).",
      windows: [
        {
          id: "claim-2-windows", title: "M2 and nominal GDP over several windows",
          note: "Selected year-end M2 and annual GDP, from the Money Over Time history file. The same arithmetic is applied to every row; no window is preferred.",
          columns: ["M2 a year", "Nominal GDP a year", "M2 as % of GDP, start", "M2 as % of GDP, end"],
          rows: [
            { label: "1971 to 2025", cells: ["{{m2.cagr.1971.2025|p2}}", "{{gdp.cagr.1971.2025|p2}}", "{{m2.share.gdp.1971|p1}}", "{{m2.share.gdp.2025|p1}}"] },
            { label: "2000 to 2025", cells: ["{{m2.cagr.2000.2025|p2}}", "{{gdp.cagr.2000.2025|p2}}", "{{m2.share.gdp.2000|p1}}", "{{m2.share.gdp.2025|p1}}"] },
            { label: "2008 to 2025", cells: ["{{m2.cagr.2008.2025|p2}}", "{{gdp.cagr.2008.2025|p2}}", "{{m2.share.gdp.2008|p1}}", "{{m2.share.gdp.2025|p1}}"] },
            { label: "2015 to 2025, the latest ten years in the file", cells: ["{{m2.cagr.2015.2025|p2}}", "{{gdp.cagr.2015.2025|p2}}", "{{m2.share.gdp.2015|p1}}", "{{m2.share.gdp.2025|p1}}"] }
          ]
        }
      ],
      right: [
        { kind: "trend", text: "M2 has grown faster than output over the long run: {{m2.cagr.1971.2025|p2}} a year for M2 against {{gdp.cagr.1971.2025|p2}} for nominal GDP from 1971 to 2025, so M2 rose {{m2.ratio.1971.2025|x1}} while GDP rose {{gdp.ratio.1971.2025|x1}}. M2 relative to GDP went from {{m2.share.gdp.1971|p1}} in 1971 to {{m2.share.gdp.2025|p1}} in 2025, and {{m2.share.gdp.2020|p1}} in 2020 (selected year-end values; 2021 is not one of them).", refs: ["money_history"] },
        { kind: "trend", cited: true, text: "The 2020-22 expansion was extreme. US M2 rose 40.6 percent in 25 months (February 2020 to March 2022), and its year-on-year growth peaked at 26.8 percent in February 2021, the highest in the FRED series, which starts in 1959. Only about $0.81 trillion of the $6.30 trillion rise matched growth in bank loans.", refs: ["fred_m2sl", "fred_h8"] },
        { kind: "interpretation", text: "The rest of the rise is usually attributed to deficit financing and Federal Reserve asset purchases. That split is an inference, not a published result: banks' own purchases of securities also create deposits, and deficits and Fed purchases overlap, so it cannot be read off these two figures.", refs: ["fred_m2sl", "fred_h8"] },
        { kind: "trend", text: "Consumer prices then rose {{cpi.pct.2020-02.latest|p1}} from February 2020 to {{cpi.latestperiod}}. The year-on-year rate was {{cpi.yoy.2022-06|p2}} in June 2022, the highest reading since 1981. M2 was not the only force in those months: energy and supply-chain shocks and fiscal transfers arrived at the same time, and economists disagree on the shares (see below).", refs: ["bls_cpi"] },
        { kind: "trend", cited: true, text: "Fast credit growth predicts financial crises and slower recoveries across advanced economies (Schularick and Taylor 2012). Private credit in 17 advanced economies rose from 62 percent of GDP in 1980 to 118 percent in 2010.", refs: ["schularick_taylor2012", "jst2017"] }
      ],
      notRight: [
        { kind: "fact", text: "Nominal GDP is real output times the price level, so a two percent inflation goal adds to nominal growth every year.", refs: ["fed_inflation_goal"] },
        { kind: "interpretation", text: "A rising M2 level is therefore expected in a growing economy, on the view that the demand for money grows with nominal income. That is a premise, not an identity: sound-money critics reply that money need not grow with output, and the late-19th-century deflation under the gold standard is said to have had little output cost (see the gold standard card).", refs: ["fed_inflation_goal", "bordo_lane_redish2004"] },
        { kind: "trend", text: "M2 relative to GDP is not a one-way ratchet. It was {{m2.share.gdp.1960|p1}} in 1960, {{m2.share.gdp.1980|p1}} in 1980, {{m2.share.gdp.1990|p1}} in 1990 and {{m2.share.gdp.2000|p1}} in 2000, then {{m2.share.gdp.2008|p1}} in 2008, {{m2.share.gdp.2015|p1}} in 2015, {{m2.share.gdp.2020|p1}} in 2020 and {{m2.share.gdp.2025|p1}} in 2025.", refs: ["money_history"] },
        { kind: "trend", cited: true, text: "A high ratio is not a failure signal by itself. World Bank broad money relative to GDP in 2024 was about 257 percent in Japan, 228 percent in China, 142 percent in the UK, 99 percent in the US and 43 percent in Turkiye, where inflation has been far higher. Definitions differ across countries, so compare trends rather than levels.", refs: ["wb_broad_money"] },
        { kind: "trend", text: "In a low-inflation regime M2 and prices can part company for years. From 2010 to 2015 M2 grew {{m2.cagr.2010.2015|p2}} a year while consumer prices grew {{cpi.cagr.2010.2015|p2}} a year.", refs: ["money_history", "bls_cpi"] },
        { kind: "interpretation", text: "Across countries and decades the link between money growth and inflation is strong when inflation is high and weak when it is low, so 'M2 up means prices up' is unreliable over a decade in a low-inflation regime. What the evidence supports is narrower: M2 growth far above output growth, which came mostly from state and central-bank action rather than from loans, was followed by the 2021-22 inflation. Whether it caused that inflation is disputed, because supply shocks and fiscal support arrived in the same months (see below).", refs: ["mccandless_weber1995", "degrauwe_polan2005", "sargent_surico2011"] }
      ],
      numbers: [
        { label: "M2 growth per year, 1971 to 2025", ph: "{{m2.cagr.1971.2025|p2}}" },
        { label: "Nominal GDP growth per year, 1971 to 2025", ph: "{{gdp.cagr.1971.2025|p2}}" },
        { label: "M2 as % of GDP, 1971", ph: "{{m2.share.gdp.1971|p1}}" },
        { label: "M2 as % of GDP, 2000", ph: "{{m2.share.gdp.2000|p1}}" },
        { label: "M2 as % of GDP, 2020", ph: "{{m2.share.gdp.2020|p1}}" },
        { label: "M2 as % of GDP, 2025", ph: "{{m2.share.gdp.2025|p1}}" },
        { label: "M2 growth per year, 2010 to 2015", ph: "{{m2.cagr.2010.2015|p2}}" },
        { label: "Consumer price growth per year, 2010 to 2015", ph: "{{cpi.cagr.2010.2015|p2}}" },
        { label: "Consumer prices since February 2020", ph: "{{cpi.pct.2020-02.latest|p1}}" },
        { label: "Consumer prices, year on year, June 2022", ph: "{{cpi.yoy.2022-06|p2}}" },
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", cited: true, text: "How much of the 2021-22 inflation was demand from fiscal and monetary support and how much was supply. Jorda and co-authors attribute about 3 points of US excess inflation to fiscal support; Bernanke and Blanchard (2023) find that most of the 2021 surge came from shocks to prices given wages, such as commodities and sector spikes.", refs: ["jorda_liu2022", "bernanke_blanchard2023"] },
        { kind: "interpretation", text: "Whether the excess M2 of the 2010s flowed into asset prices. This is an inference, not an established finding, and this site holds no stock or bond price series, so the page cannot test it.", refs: [] }
      ],
      objection: [
        { against: "The 'partly supported' verdict as too generous to the claim", text: "A rising M2 in a growing economy with a two percent goal is exactly what a healthy system would show. Nominal GDP grew {{gdp.cagr.1971.2025|p2}} a year over 1971 to 2025 and M2 grew {{m2.cagr.1971.2025|p2}}, which is close, although the table shows a wider gap in the later windows (from 2000, {{m2.cagr.2000.2025|p2}} a year for M2 against {{gdp.cagr.2000.2025|p2}} for GDP). Reading structural weakness into the M2 level is still a leap, because the ratio of M2 to GDP depends on interest rates, policy and the demand for money as much as on structure.", refs: ["money_history"] },
        { against: "The 'partly supported' verdict as too generous to the system", text: "M2 relative to GDP went from {{m2.share.gdp.2000|p1}} in 2000 to {{m2.share.gdp.2020|p1}} in 2020 and a simple money-demand story explains only part of that rise. M2 outgrew nominal GDP in the 2010s, and the excess may have gone into asset prices (a Cantillon channel; an inference). People wanted to hold more money partly because of the policy itself (asset purchases and near-zero rates).", refs: ["money_history"] }
      ],
      change: [
        "Toward Supported: evidence that M2 growth above output growth, without a matching rise in credit, reliably precedes inflation or asset busts in low-inflation regimes.",
        "Toward Not supported: a rise in M2 relative to GDP that carried no increase in leverage, crisis frequency or inflation across several countries would show that the ratio alone says little about structure.",
        "A measurable definition of 'structured well' (for example the frequency of financial crises, or the volatility of output) would let this verdict be tested directly rather than through proxies."
      ],
      limits: [
        "This card tests proxies for 'structured badly': M2 relative to GDP, credit relative to GDP and inflation episodes. It does not test fairness, innovation or productivity.",
        "The history file holds selected years, not every year, so the ratios are for the years named. Year-end M2 is divided by annual GDP of the same year.",
        "The 2020-22 figures and the cross-country broad-money ratios are published figures, not recomputed here.",
        "No stock or bond price series ships with this site, so the asset-price channel (the Cantillon effect) is stated as an inference and cannot be tested on this page."
      ],
      links: [
        { label: "Money Over Time: M2, GDP and M2 relative to GDP", href: "monetary-history.html#v=history&sh=usM2,usGDP" },
        { label: "Money Flow: how money is created", href: "money-flow.html" },
        { label: "Debt: credit relative to GDP", href: "debt.html" }
      ],
      refs: ["money_history", "bls_cpi", "fred_m2sl", "fred_h8", "schularick_taylor2012", "jst2017", "wb_broad_money", "mccandless_weber1995", "degrauwe_polan2005", "sargent_surico2011", "jorda_liu2022", "bernanke_blanchard2023", "fed_inflation_goal"]
    },

    // ---------------------------------------------------------------- 3
    {
      id: "claim-3", n: 3,
      quick: "Years for prices to double: {{cpi.doubling.1913-01.latest|yrs1}} since 1913, {{cpi.doubling.1971-08.latest|yrs1}} since August 1971, {{cpi.doubling.1991-09.latest|yrs1}} since September 1991, {{cpi.doubling.latest-10y.latest|yrs1}} over ten years, {{cpi.doubling.latest-5y.latest|yrs1}} over five. The claim: 17.",
      claim: "Prices roughly double every 17 years.",
      asked: "Whatever a dollar buys today, it will buy half as much in about 17 years.",
      verdict: "True in some windows",
      verdictLine: "It fits August 1971 to now ({{cpi.doubling.1971-08.latest|yrs1}} against 17), the latest five years ({{cpi.doubling.latest-5y.latest|yrs1}}) and February 2020 to now ({{cpi.doubling.2020-02.latest|yrs1}}). It does not fit 1913 to now, 1991 to now or the latest ten years.",
      text: "A 17-year doubling needs {{calc.rate_for_doubling.17|p2}} inflation a year. 'Roughly 17 years' is taken here as a doubling time within 1.5 years of 17, the same rule on this page and on the Prices page. By that rule the claim fits three of the six windows tested side by side: August 1971, the latest five years and February 2020. The August 1971 average blends the Great Inflation, when prices doubled in about eight years, with the decades after 1983, when they doubled in about 24. The claim is a window choice, not a constant, which is why the first table shows six windows side by side, the second adds other start dates, and the picker lets you test any other.",
      windows: [
        {
          id: "claim-3-windows", title: "Years for US consumer prices to double, over six windows",
          note: "Each row runs from the start month to the newest month in the data. The same arithmetic is applied to every row. The last three rows are benchmarks, not data.",
          columns: ["Years to double", "Average per year", "A dollar keeps"],
          rows: [
            { label: "January 1913 to latest", cells: ["{{cpi.doubling.1913-01.latest|yrs1}}", "{{cpi.cagr.1913-01.latest|p2}}", "{{cpi.power.1913-01.latest|p1}}"] },
            { label: "August 1971 to latest", cells: ["{{cpi.doubling.1971-08.latest|yrs1}}", "{{cpi.cagr.1971-08.latest|p2}}", "{{cpi.power.1971-08.latest|p1}}"] },
            { label: "September 1991 to latest", cells: ["{{cpi.doubling.1991-09.latest|yrs1}}", "{{cpi.cagr.1991-09.latest|p2}}", "{{cpi.power.1991-09.latest|p1}}"] },
            { label: "Latest 10 years", cells: ["{{cpi.doubling.latest-10y.latest|yrs1}}", "{{cpi.cagr.latest-10y.latest|p2}}", "{{cpi.power.latest-10y.latest|p1}}"] },
            { label: "Latest 5 years", cells: ["{{cpi.doubling.latest-5y.latest|yrs1}}", "{{cpi.cagr.latest-5y.latest|p2}}", "{{cpi.power.latest-5y.latest|p1}}"] },
            { label: "February 2020 to latest", cells: ["{{cpi.doubling.2020-02.latest|yrs1}}", "{{cpi.cagr.2020-02.latest|p2}}", "{{cpi.power.2020-02.latest|p1}}"] },
            { label: "Benchmark: the claim, doubling every 17 years", benchmark: true, cells: ["-", "{{calc.rate_for_doubling.17|p2}}", "-"] },
            { label: "Benchmark: two percent a year (the Federal Reserve's goal)", benchmark: true, cells: ["{{calc.doubling_from_rate.2|yrs1}}", "-", "-"] },
            { label: "Benchmark: the edges of 'roughly 17 years' (15.5 and 18.5 years)", benchmark: true, cells: ["15.5 to 18.5", "-", "-"] }
          ]
        },
        {
          id: "claim-3-other", title: "Other windows",
          note: "The first seven rows use single months, like the table above. The rows from 1972 use annual averages, which give slightly different doubling times.",
          columns: ["Years to double", "Average per year"],
          rows: [
            { label: "January 1913 to August 1971", cells: ["{{cpi.doubling.1913-01.1971-08|yrs1}}", "{{cpi.cagr.1913-01.1971-08|p2}}"] },
            { label: "January 1946 to latest (after the war)", cells: ["{{cpi.doubling.1946-01.latest|yrs1}}", "{{cpi.cagr.1946-01.latest|p2}}"] },
            { label: "January 1950 to latest", cells: ["{{cpi.doubling.1950-01.latest|yrs1}}", "{{cpi.cagr.1950-01.latest|p2}}"] },
            { label: "January 1960 to latest", cells: ["{{cpi.doubling.1960-01.latest|yrs1}}", "{{cpi.cagr.1960-01.latest|p2}}"] },
            { label: "January 1965 to latest", cells: ["{{cpi.doubling.1965-01.latest|yrs1}}", "{{cpi.cagr.1965-01.latest|p2}}"] },
            { label: "August 1971 to January 1983 (before the CPI-U dropped house prices)", cells: ["{{cpi.doubling.1971-08.1983-01|yrs1}}", "{{cpi.cagr.1971-08.1983-01|p2}}"] },
            { label: "January 1983 to latest", cells: ["{{cpi.doubling.1983-01.latest|yrs1}}", "{{cpi.cagr.1983-01.latest|p2}}"] },
            { label: "1972 to 1982 (the highest ten-year stretch in annual averages)", cells: ["{{cpi.doubling.1972.1982|yrs1}}", "{{cpi.cagr.1972.1982|p2}}"] },
            { label: "1923 to 1933 (a fall in the price level)", cells: ["-", "{{cpi.cagr.1923.1933|p2}}"] },
            { label: "1971 to 2024", cells: ["{{cpi.doubling.1971.2024|yrs1}}", "{{cpi.cagr.1971.2024|p2}}"] },
            { label: "1991 to 2024", cells: ["{{cpi.doubling.1991.2024|yrs1}}", "{{cpi.cagr.1991.2024|p2}}"] }
          ]
        }
      ],
      picker: { series: "cpi", from: "1913-01", rules: ["doubling", "cagr", "power"], note: "Choose any start month and end month between January 1913 and the newest month." },
      right: [
        { kind: "trend", text: "From the closing of the gold window in August 1971 to {{cpi.latestperiod}}, US consumer prices rose {{cpi.ratio.1971-08.latest|x1}}, an average of {{cpi.cagr.1971-08.latest|p2}} a year, so they doubled every {{cpi.doubling.1971-08.latest|yrs1}}. A dollar kept {{cpi.power.1971-08.latest|p1}} of its 1971 purchasing power.", refs: ["bls_cpi", "fedhist_gold_ends"] },
        { kind: "fact", text: "A doubling in 17 years needs {{calc.rate_for_doubling.17|p2}} a year (two to the power one over 17, minus one). The claim's figure is close to the post-1971 average.", refs: [] },
        { kind: "trend", text: "The Great Inflation sits inside that window but not at the claim's pace. From 1972 to 1982 prices rose {{cpi.cagr.1972.1982|p2}} a year and doubled every {{cpi.doubling.1972.1982|yrs1}}, about twice as fast as the claim. The August 1971 window comes close to 17 years because that decade is averaged with the years after January 1983, when prices doubled only every {{cpi.doubling.1983-01.latest|yrs1}}.", refs: ["bls_cpi", "fedhist_great_inflation"] },
        { kind: "trend", text: "Over the latest five years prices doubled every {{cpi.doubling.latest-5y.latest|yrs1}} ({{cpi.cagr.latest-5y.latest|p2}} a year) and since February 2020 every {{cpi.doubling.2020-02.latest|yrs1}} ({{cpi.cagr.2020-02.latest|p2}} a year). Recent inflation fits the claim, although a five-year pace says little about a 17-year doubling.", refs: ["bls_cpi"] },
        { kind: "trend", text: "Across the {{cpi.startyears.1913.2021}} January start years from 1913 to 2021, {{cpi.startfit.1913.2021}} give a doubling time within 1.5 years of 17 (start dates from the early 1960s to the mid-1970s and the last few years), {{cpi.startcount.1913.2021.0.20}} give 20 years or less and {{cpi.startcount.1913.2021.25.1000}} give 25 years or more, each to {{cpi.latestperiod}}.", refs: ["bls_cpi"] },
        { kind: "trend", text: "Pay moved at a similar pace in money terms: average hourly pay of production and nonsupervisory workers doubled every {{pay.doubling.1971.2024|yrs1}} from 1971 to 2024 (annual averages).", refs: ["bls_ces"] }
      ],
      notRight: [
        { kind: "trend", text: "Over longer windows, and over the latest ten years, 17 years overstates the pace. Since January 1913 prices doubled every {{cpi.doubling.1913-01.latest|yrs1}}; since September 1991 every {{cpi.doubling.1991-09.latest|yrs1}}; over the latest ten years every {{cpi.doubling.latest-10y.latest|yrs1}}. At two percent a year a doubling takes {{calc.doubling_from_rate.2|yrs1}}.", refs: ["bls_cpi", "fed_inflation_goal"] },
        { kind: "trend", text: "Before 1971 the pace was slower and the path was not one-way. From January 1913 to August 1971 prices doubled every {{cpi.doubling.1913-01.1971-08|yrs1}}, and between 1923 and 1933 the annual rate was {{cpi.cagr.1923.1933|p1}}, a fall in the price level. Start dates after the war give 18 to 20 years (second table).", refs: ["bls_cpi"] },
        { kind: "fact", text: "'Every 17 years' is a window choice, not a constant. The doubling time depends on the start and end dates.", refs: [] },
        { kind: "trend", text: "The purchasing power of a dollar is not the purchasing power of a wage. Average hourly pay of production and nonsupervisory workers rose {{pay.realchange.cpi.1964.2024|p1}} after inflation from 1964 to 2024 and {{pay.realchange.cpi.1973.2024|p1}} from 1973 to 2024 (annual averages; a narrow pay series that excludes benefits). Median household income rose {{income.realchange.cpi.1984.2024|p1}} after inflation from 1984 to 2024 (current dollars deflated by CPI-U).", refs: ["bls_ces", "census_cps", "bls_cpi"] },
        { kind: "trend", text: "Price stability under the gold standard had its own costs, but the usual UK example needs care. UK retail prices rose {{ukrpia.cagr.1870.1913|p2}} a year from 1870 to 1913. They then rose {{ukrpia.pct.1913.1920|p1}} from 1913 to 1920, while convertibility was suspended for the war, and changed by {{ukrpia.pct.1920.1933|p1}} from 1920 to 1933, a net change of {{ukrpia.pct.1913.1933|p1}} over 1913 to 1933. Most of the fall came before Britain returned to gold in April 1925 ({{ukrpia.pct.1920.1925|p1}} from 1920 to 1925, against {{ukrpia.pct.1925.1931|p1}} from 1925 to the exit in September 1931). The cleaner example of deflation while on gold is the US in 1929-33, when consumer prices changed by {{cpi.pct.1929.1933|p1}}.", refs: ["ons_rpi", "bordo_nber1999", "bls_cpi"] },
        { kind: "trend", text: "Part of the 1970s figure comes from how the index was built. Before January 1983 the CPI-U counted house purchase prices and mortgage interest costs, which raised measured inflation when house prices and mortgage rates rose; since then it measures shelter through rents. From August 1971 to January 1983 prices doubled every {{cpi.doubling.1971-08.1983-01|yrs1}}, and from January 1983 to {{cpi.latestperiod}} every {{cpi.doubling.1983-01.latest|yrs1}}.", refs: ["bls_cpi", "bls_oer_1983"] },
        { kind: "trend", cited: true, text: "Another price index gives a lower pace. The PCE price index rose 5.5 times from 1973 to 2024 against 7.1 times for the CPI-U, about 0.5 points a year less, and the pay of production and nonsupervisory workers after PCE inflation rose about 32 percent over those years, against about 3 percent after CPI-U inflation (research calculation from annual averages of the FRED series PCEPI; this site does not ship that series).", refs: ["bea_pce", "bls_cpi", "bls_ces"] },
        { kind: "trend", cited: true, text: "Classical-era US inflation averaged 0.1 percent a year in 1880-1914 against 4.1 percent in 1946-2003, but output was more volatile than under the post-1970 float in the 15-country sample of Basu and Taylor.", refs: ["bordo_econlib", "basu_taylor1999"] }
      ],
      numbers: [
        { label: "Years to double, January 1913 to latest", ph: "{{cpi.doubling.1913-01.latest|yrs1}}" },
        { label: "Years to double, August 1971 to latest", ph: "{{cpi.doubling.1971-08.latest|yrs1}}" },
        { label: "Years to double, September 1991 to latest", ph: "{{cpi.doubling.1991-09.latest|yrs1}}" },
        { label: "Years to double, latest 10 years", ph: "{{cpi.doubling.latest-10y.latest|yrs1}}" },
        { label: "Years to double, latest 5 years", ph: "{{cpi.doubling.latest-5y.latest|yrs1}}" },
        { label: "Years to double, February 2020 to latest", ph: "{{cpi.doubling.2020-02.latest|yrs1}}" },
        { label: "January start years from 1913 to 2021 within 1.5 years of 17", ph: "{{cpi.startfit.1913.2021|n0}}", note: "Out of the start years in the next row" },
        { label: "January start years from 1913 to 2021", ph: "{{cpi.startyears.1913.2021|n0}}" },
        { label: "Growth a year needed to double in 17 years", ph: "{{calc.rate_for_doubling.17|p2}}" },
        { label: "Years to double at two percent a year", ph: "{{calc.doubling_from_rate.2|yrs1}}" },
        { label: "A dollar of 1913 keeps", ph: "{{cpi.power.1913-01.latest|p1}}" },
        { label: "A dollar of August 1971 keeps", ph: "{{cpi.power.1971-08.latest|p1}}" },
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" },
        { label: "Pay for production workers after inflation, 1964 to 2024", ph: "{{pay.realchange.cpi.1964.2024|p1}}" },
        { label: "The same, 1973 to 2024", ph: "{{pay.realchange.cpi.1973.2024|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", text: "Which price index to use (CPI-U or the PCE index; how to treat housing and quality change). The PCE index rose about 0.5 points a year less than the CPI-U from 1973 to 2024 (research calculation, above), so every doubling time here would be longer on that index. This page does not recompute its windows on the PCE index.", refs: ["bea_pce"] },
        { kind: "interpretation", cited: true, text: "Whether a growth-rate target that lets the price level compound is better than a price-level target that makes up for overshoots, and how much of the Great Moderation reflects policy rather than luck. Stock and Watson (2002) assign 40 to 60 percent of the decline in volatility to unidentified smaller shocks; Ball and Sheridan (2003) find no clear effect of inflation targeting itself. On the other side, Roger (IMF 2009) finds that inflation targeters compare favourably, and the Federal Reserve's own account credits improved policy as probably an important source of the Great Moderation.", refs: ["stock_watson2002", "ball_sheridan2003", "roger2009", "fedhist_great_moderation"] }
      ],
      objection: [
        { against: "The 'true in some windows' verdict, from the side of the claim", text: "A dollar has kept only {{cpi.power.1913-01.latest|p1}} of its January 1913 purchasing power. The argument is that an inflation target fixes the rate, not the level, so every overshoot is kept and prices compound; that credibility failed twice, in 1965-82 and in 2021-23; and that a regime with a price-level anchor would not have allowed a loss of this size. UK retail prices rose {{ukrpia.cagr.1870.1913|p2}} a year over 1870 to 1913.", refs: ["bls_cpi", "ons_rpi", "ball_sheridan2003"] },
        { against: "The 'true in some windows' verdict, from the other side", text: "The long window that fits contains the Great Inflation of 1965-82 and averages it with the calm decades after it, and the recent windows that fit are short. Gold-standard price stability came with larger swings in output and long deflations, and the Federal Reserve aims for two percent partly to keep a buffer against deflation. Money lost purchasing power while pay rose in money terms: pay doubled every {{pay.doubling.1971.2024|yrs1}} over 1971 to 2024.", refs: ["fed_inflation_goal", "bordo_econlib", "bls_ces"] }
      ],
      change: [
        "If US inflation averaged {{calc.rate_for_doubling.17|p2}} a year or more over the coming decade, the latest-ten-years window would match the claim and the 1991 window would move toward it.",
        "Start dates from the early 1960s to the mid-1970s, and the last few years, give a doubling time within 1.5 years of the claim; start dates from the 1980s to the mid-2010s give 21 to 28 years. If the claim is meant for one specific window, the card should test only that window, and the verdict would be Supported or Not supported for it.",
        "A different price index (PCE, or a CPI that treats housing differently) would shift every row. The verdict would change if the shift moved the 1913 and 1991 windows to 17 years."
      ],
      limits: [
        "Consumer prices only. House and asset prices are a separate claim (claim 4).",
        "Rows that run 'to latest' compare single months. Annual averages give slightly different doubling times, as the second table shows.",
        "The CPI-U series has no October 2025 observation (a federal funding lapse stopped collection), so 2025 is not a complete year in these data.",
        "Pay is the cash hourly earnings of production and nonsupervisory workers. It excludes benefits and managers.",
        "Before January 1983 the CPI-U counted house purchase prices and mortgage interest, so the 1970s are not on the same basis as later years."
      ],
      links: [
        { label: "Prices and Purchasing Power: the doubling-time calculator", href: "prices.html" },
        { label: "Money Over Time: the dollar and gold since 1971", href: "monetary-history.html#v=history" }
      ],
      refs: ["bls_cpi", "fedhist_gold_ends", "fedhist_great_inflation", "fed_inflation_goal", "bls_ces", "census_cps", "ons_rpi", "bordo_nber1999", "bordo_econlib", "basu_taylor1999", "stock_watson2002", "ball_sheridan2003", "roger2009", "fedhist_great_moderation", "bls_oer_1983", "bea_pce"]
    },

    // ---------------------------------------------------------------- 4
    {
      id: "claim-4", n: 4,
      quick: "After inflation, US house prices rose {{hpi.realchange.cpi.1987.2024|p1}} (FHFA, 1987 to 2024) and UK house prices {{ukhouse.realchange.ukcpi.1990.2024|p1}} (CPI, 1990 to 2024); the median new house cost {{house.hours.pay.2025|hrs0}} of pay in 2025.",
      claim: "Housing goes even higher than general inflation.",
      asked: "House prices rise faster than consumer prices, so a pay cheque that keeps up with the price of bread falls behind the price of a home.",
      verdict: "Supported",
      verdictLine: "Supported for US and UK house prices since about 1975 on the main measures. Not before about 1975, not by every measure or in every country, and the cause is contested.",
      text: "Since the mid-1970s US and UK house prices have risen faster than consumer prices on the main measures, and a median new house takes many more hours of pay than it did in the 1960s. Before the mid-1970s house prices tracked consumer prices. On Statistics Canada's builders' price indexes for new houses (the structure and the lot; not resale or all-house indexes) the structure rose {{cahouse.realchange.cacpi.1981.2024|p1}} after inflation from 1981 to 2024 and the lot {{caland.realchange.cacpi.1981.2024|p1}}, so neither shows a rise like the US and UK, and the evidence on whether money creation or limited land and rules is the cause points to several factors at once.",
      windows: [
        {
          id: "claim-4-indexes", title: "House prices and consumer prices, over several windows",
          note: "Annual averages. Each row names its house-price source; the sources are never joined into one series. 'After inflation' is the change in house prices divided by the change in consumer prices.",
          columns: ["House prices", "Consumer prices", "House prices after inflation"],
          rows: [
            { label: "1913 to 1950 (Shiller compilation of several sources)", cells: ["{{shiller.ratio.1913.1950|x1}}", "{{cpi.ratio.1913.1950|x1}}", "{{shiller.realchange.cpi.1913.1950|p1}}"] },
            { label: "1950 to 1974 (Shiller compilation)", cells: ["{{shiller.ratio.1950.1974|x1}}", "{{cpi.ratio.1950.1974|x1}}", "{{shiller.realchange.cpi.1950.1974|p1}}"] },
            { label: "1975 to 2024 (FHFA)", cells: ["{{hpi.ratio.1975.2024|x1}}", "{{cpi.ratio.1975.2024|x1}}", "{{hpi.realchange.cpi.1975.2024|p1}}"] },
            { label: "1987 to 2024 (FHFA)", cells: ["{{hpi.ratio.1987.2024|x1}}", "{{cpi.ratio.1987.2024|x1}}", "{{hpi.realchange.cpi.1987.2024|p1}}"] },
            { label: "2000 to 2024 (FHFA)", cells: ["{{hpi.ratio.2000.2024|x1}}", "{{cpi.ratio.2000.2024|x1}}", "{{hpi.realchange.cpi.2000.2024|p1}}"] },
            { label: "2014 to 2024, the latest ten full years (FHFA)", cells: ["{{hpi.ratio.2014.2024|x1}}", "{{cpi.ratio.2014.2024|x1}}", "{{hpi.realchange.cpi.2014.2024|p1}}"] }
          ]
        },
        {
          id: "claim-4-others", title: "Other measures and other countries",
          note: "Annual averages. The median new house is not adjusted for quality or size. The UK has no consumer prices index (CPI) before 1988, so the 1970 row uses the retail prices index (RPI); from 1990 the rows use the CPI, with the RPI beside it for comparison. The RPI includes mortgage interest and a house depreciation cost measured with house prices. The Canadian rows are builders' selling prices for new houses, split into the structure and the lot; they are not resale or all-house indexes and the total is not stored. Farmland is a proxy for land, not residential land.",
          columns: ["Prices", "Consumer prices", "After inflation"],
          rows: [
            { label: "US median new house, 1971 to 2024 (Census and HUD)", cells: ["{{house.ratio.1971.2024|x1}}", "{{cpi.ratio.1971.2024|x1}}", "{{house.realchange.cpi.1971.2024|p1}}"] },
            { label: "UK average house price, 1970 to 2024 (Land Registry, against the RPI, the only UK index back to 1970)", cells: ["{{ukhouse.ratio.1970.2024|x1}}", "{{ukrpi.ratio.1970.2024|x1}}", "{{ukhouse.realchange.ukrpi.1970.2024|p1}}"] },
            { label: "UK, 1990 to 2024, against the CPI", cells: ["{{ukhouse.ratio.1990.2024|x1}}", "{{ukcpi.ratio.1990.2024|x1}}", "{{ukhouse.realchange.ukcpi.1990.2024|p1}}"] },
            { label: "The same window against the RPI, for comparison", cells: ["{{ukhouse.ratio.1990.2024|x1}}", "{{ukrpi.ratio.1990.2024|x1}}", "{{ukhouse.realchange.ukrpi.1990.2024|p1}}"] },
            { label: "UK, 2000 to 2024, against the CPI", cells: ["{{ukhouse.ratio.2000.2024|x1}}", "{{ukcpi.ratio.2000.2024|x1}}", "{{ukhouse.realchange.ukcpi.2000.2024|p1}}"] },
            { label: "The same window against the RPI, for comparison", cells: ["{{ukhouse.ratio.2000.2024|x1}}", "{{ukrpi.ratio.2000.2024|x1}}", "{{ukhouse.realchange.ukrpi.2000.2024|p1}}"] },
            { label: "UK, 2010 to 2024, against the CPI", cells: ["{{ukhouse.ratio.2010.2024|x1}}", "{{ukcpi.ratio.2010.2024|x1}}", "{{ukhouse.realchange.ukcpi.2010.2024|p1}}"] },
            { label: "The same window against the RPI, for comparison", cells: ["{{ukhouse.ratio.2010.2024|x1}}", "{{ukrpi.ratio.2010.2024|x1}}", "{{ukhouse.realchange.ukrpi.2010.2024|p1}}"] },
            { label: "Canada new housing price index, structure only, 1981 to 2024 (new houses, against Canadian CPI)", cells: ["{{cahouse.ratio.1981.2024|x1}}", "{{cacpi.ratio.1981.2024|x1}}", "{{cahouse.realchange.cacpi.1981.2024|p1}}"] },
            { label: "Canada, lot (land) component of the same index, a proxy", cells: ["{{caland.ratio.1981.2024|x1}}", "{{cacpi.ratio.1981.2024|x1}}", "{{caland.realchange.cacpi.1981.2024|p1}}"] },
            { label: "US farmland per acre, 1950 to 2024 (USDA, a proxy for land)", cells: ["{{farmland.ratio.1950.2024|x1}}", "{{cpi.ratio.1950.2024|x1}}", "{{farmland.realchange.cpi.1950.2024|p1}}"] }
          ]
        }
      ],
      right: [
        { kind: "trend", text: "US: the FHFA repeat-sales index rose {{hpi.ratio.1987.2024|x1}} from 1987 to 2024 while consumer prices rose {{cpi.ratio.1987.2024|x1}}, so house prices rose {{hpi.realchange.cpi.1987.2024|p1}} after inflation. House prices doubled every {{hpi.doubling.1987.2024|yrs1}} against {{cpi.doubling.1987.2024|yrs1}} for consumer prices.", refs: ["fhfa_hpi", "bls_cpi"] },
        { kind: "trend", text: "The Census median new-house price rose {{house.ratio.1971.2024|x1}} from 1971 to 2024 against {{cpi.ratio.1971.2024|x1}} for consumer prices, doubling every {{house.doubling.1971.2024|yrs1}} against {{cpi.doubling.1971.2024|yrs1}}. This series is not adjusted for quality, and new homes are larger than they were.", refs: ["census_nrs", "bls_cpi"] },
        { kind: "trend", text: "UK: the Land Registry average price rose {{ukhouse.ratio.1970.2024|x1}} from 1970 to 2024 against {{ukrpi.ratio.1970.2024|x1}} for retail prices (the RPI, the only UK index back to 1970), which is {{ukhouse.realchange.ukrpi.1970.2024|p1}} after inflation. Against the consumer prices index (CPI, available from 1988) the rise after inflation was {{ukhouse.realchange.ukcpi.1990.2024|p1}} from 1990 and {{ukhouse.realchange.ukcpi.2000.2024|p1}} from 2000.", refs: ["hmlr_ukhpi", "ons_rpi", "ons_cpi"] },
        { kind: "trend", text: "The RPI includes owner-occupiers' mortgage interest and a house depreciation cost that the ONS measures with house prices, which the CPI leaves out. A deflator that rises with house prices makes house prices look flatter after inflation: from 2000 to 2024 the rise after inflation is {{ukhouse.realchange.ukrpi.2000.2024|p1}} on the RPI and {{ukhouse.realchange.ukcpi.2000.2024|p1}} on the CPI.", refs: ["ons_rpi_shortcomings", "ons_rpi", "ons_cpi"] },
        { kind: "trend", text: "Price to income and hours of pay. The median new-house price was {{house.per.income.1984|n2}} times median household income in 1984, {{house.per.income.2000|n2}} in 2000, {{house.per.income.2006|n2}} in 2006, {{house.per.income.2022|n2}} in 2022 and {{house.per.income.2025|n2}} in 2025. In hours of production-worker pay the median new house cost {{house.hours.pay.1964|hrs0}} in 1964, {{house.hours.pay.1973|hrs0}} in 1973, {{house.hours.pay.1990|hrs0}} in 1990 and {{house.hours.pay.2025|hrs0}} in 2025.", refs: ["census_nrs", "census_cps", "bls_ces"] },
        { kind: "trend", cited: true, text: "England's median house price was 7.6 times median full-time workplace earnings in 2025.", refs: ["ons_afford2025"] }
      ],
      notRight: [
        { kind: "trend", text: "Not before the mid-1970s. Shiller's compilation (built from several sources, less comparable before 1953) rose {{shiller.ratio.1913.1950|x1}} from 1913 to 1950 against {{cpi.ratio.1913.1950|x1}} for consumer prices ({{shiller.realchange.cpi.1913.1950|p1}} after inflation) and changed by {{shiller.realchange.cpi.1950.1974|p1}} after inflation from 1950 to 1974: roughly the pace of consumer prices.", refs: ["shiller_data", "bls_cpi"] },
        { kind: "trend", cited: true, text: "Across 14 economies, real house prices were roughly constant from 1870 to the mid-20th century, and UK real prices fell about 1 percent a year from 1899 to 1938.", refs: ["knoll2017"] },
        { kind: "trend", text: "Not by every measure or in every country. Statistics Canada's New Housing Price Index is a quality-adjusted index of builders' selling prices for new houses, split into the structure and the lot. It is not a house-price index for resales or for house and land together, and a constant-specification structure index tracks building cost more than market value. On it the structure rose {{cahouse.ratio.1981.2024|x1}} from 1981 to 2024 against {{cacpi.ratio.1981.2024|x1}} for consumer prices ({{cahouse.realchange.cacpi.1981.2024|p1}} after inflation) and the lot beneath it rose {{caland.ratio.1981.2024|x1}} ({{caland.realchange.cacpi.1981.2024|p1}} after inflation). The total of house and land is not stored here.", refs: ["statcan_nhpi", "statcan_cpi"] },
        { kind: "trend", text: "In the UK the answer depends on the price index. House prices changed by {{ukhouse.realchange.ukrpi.2010.2024|p1}} after inflation from 2010 to 2024 on the RPI and by {{ukhouse.realchange.ukcpi.2010.2024|p1}} on the CPI. The BIS real index for the UK (2010 = 100) was about 109 in 2026 Q1, close to the CPI-based figure.", refs: ["hmlr_ukhpi", "ons_rpi", "ons_cpi", "bis_spp"] },
        { kind: "trend", cited: true, text: "Two peak-to-trough examples show what a long fall looks like, but they start near each country's price peak, so they are illustrations and not typical records: real residential property prices fell about 42 percent in Japan from 1991 to 2005 and about 24 percent in Germany from 1995 to 2010 (BIS residential property price series, reported secondhand and not re-checked here).", refs: ["bis_spp"] },
        { kind: "trend", text: "US affordability has eased from its peak: the median new-house price was {{house.per.income.2022|n2}} times median household income in 2022 and {{house.per.income.2025|n2}} in 2025.", refs: ["census_nrs", "census_cps"] },
        { kind: "fact", text: "Since January 1983 the CPI-U does not include the purchase price of houses; the BLS measures shelter through rents and owners' equivalent rent. 'General inflation' and 'house prices' are therefore different baskets. Before 1983 the CPI-U counted house prices and mortgage interest, so the index and house prices were not independent in the 1970s.", refs: ["bls_cpi_home", "bls_oer_1983"] },
        { kind: "trend", text: "Money relative to output is a better guide than the quantity of money, but still a rough one. From 1980 to 2000 M2 rose {{m2.ratio.1980.2000|x1}} but fell relative to GDP, from {{m2.share.gdp.1980|p1}} to {{m2.share.gdp.2000|p1}}, and the FHFA index rose only {{hpi.realchange.cpi.1980.2000|p1}} after inflation. From 2000 to 2020 M2 rose {{m2.ratio.2000.2020|x1}}, to {{m2.share.gdp.2020|p1}} of GDP, and the FHFA index rose {{hpi.realchange.cpi.2000.2020|p1}} after inflation. Interest rates fell over the second period, so the two periods cannot separate money from rates.", refs: ["money_history", "fhfa_hpi", "bls_cpi"] },
        { kind: "trend", cited: true, text: "In 2020-22 the Case-Shiller national index rose 44.5 percent (February 2020 to June 2022) while M2 rose 40.6 percent and the 30-year mortgage rate fell to 2.65 percent in January 2021, so money and rates moved together and cannot be separated by this episode.", refs: ["fred_csushpinsa", "fred_m2sl", "freddie_pmms"] },
        { kind: "interpretation", cited: true, text: "The cause is not shown to be money creation. Knoll, Schularick and Steger attribute about 80 percent of the 1950-2012 rise to land values. Glaeser and Gyourko attribute the gap between prices and building cost mainly to land-use rules. Rachel and Smith attribute most of a 450 basis point fall in global real rates over 30 years to saving and investment factors. Favara and Imbs and Mian and Sufi show that more mortgage credit raised prices, most where supply was inelastic.", refs: ["knoll2017", "glaeser_gyourko2018", "rachel_smith2015", "favara_imbs2015", "mian_sufi2011"] },
        { kind: "trend", text: "The 'can of pop' comparison cuts both ways. The BLS carbonated-drinks CPI rose {{carb.ratio.1987.2024|x1}} from 1987 to 2024 against {{cpi.ratio.1987.2024|x1}} for all items and {{hpi.ratio.1987.2024|x1}} for houses, which supports the claim. But the BLS price of a 12-pack of soft drinks, available only from April 2018, rose {{soft12.ratio.2018-04.latest|x2}} to {{cpi.latestperiod}} against {{cpi.ratio.2018-04.latest|x2}} for all items and {{pay.ratio.2018-04.latest|x2}} for pay: recently pop got dearer than prices in general.", refs: ["bls_cpi", "bls_ap", "bls_ces", "fhfa_hpi"] }
      ],
      numbers: [
        { label: "House prices, 1987 to 2024 (FHFA)", ph: "{{hpi.ratio.1987.2024|x1}}" },
        { label: "Consumer prices, 1987 to 2024", ph: "{{cpi.ratio.1987.2024|x1}}" },
        { label: "House prices after inflation, 1987 to 2024", ph: "{{hpi.realchange.cpi.1987.2024|p1}}" },
        { label: "Median new house, 1971 to 2024", ph: "{{house.ratio.1971.2024|x1}}" },
        { label: "Consumer prices, 1971 to 2024", ph: "{{cpi.ratio.1971.2024|x1}}" },
        { label: "Median new-house price over median household income, 1984", ph: "{{house.per.income.1984|n2}}" },
        { label: "The same, 2022", ph: "{{house.per.income.2022|n2}}" },
        { label: "The same, 2025", ph: "{{house.per.income.2025|n2}}" },
        { label: "Hours of production-worker pay for the median new house, 1973", ph: "{{house.hours.pay.1973|hrs0}}" },
        { label: "The same, 2025", ph: "{{house.hours.pay.2025|hrs0}}" },
        { label: "The same, 2025, in years of full-time work", ph: "{{house.workyears.pay.2025|yrs1}}", note: "Assumes 2,080 hours a year" },
        { label: "UK house prices after inflation, 1970 to 2024, against the RPI", ph: "{{ukhouse.realchange.ukrpi.1970.2024|p1}}" },
        { label: "UK house prices after inflation, 1990 to 2024, against the CPI", ph: "{{ukhouse.realchange.ukcpi.1990.2024|p1}}" },
        { label: "UK house prices after inflation, 2000 to 2024, against the CPI", ph: "{{ukhouse.realchange.ukcpi.2000.2024|p1}}" },
        { label: "UK house prices after inflation, 2010 to 2024, against the CPI", ph: "{{ukhouse.realchange.ukcpi.2010.2024|p1}}" },
        { label: "The same, 2010 to 2024, against the RPI", ph: "{{ukhouse.realchange.ukrpi.2010.2024|p1}}", note: "For comparison: the RPI includes costs tied to house prices" },
        { label: "Canada new-house structure index after inflation, 1981 to 2024", ph: "{{cahouse.realchange.cacpi.1981.2024|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", text: "The relative weight of supply restriction, interest rates and credit supply. Most economists agree that these interact: regions with elastic supply showed smaller booms (an inference, not tested on this page).", refs: ["glaeser_gyourko2018", "favara_imbs2015"] },
        { kind: "interpretation", text: "Whether recent price falls in some markets mark a turn or a pause. UK house prices after inflation rose {{ukhouse.realchange.ukcpi.2010.2024|p1}} from 2010 to 2024 on the CPI and changed by {{ukhouse.realchange.ukrpi.2010.2024|p1}} on the RPI, so the UK picture depends on the deflator; the US ratio of price to income has eased from its 2022 peak.", refs: ["ons_rpi_shortcomings"] }
      ],
      objection: [
        { against: "The 'supported' verdict, from the side that doubts it", text: "Supply restriction may be the larger half of the story. Glaeser and Gyourko attribute the gap between house prices and construction cost mainly to land-use rules, so cheap money meets a rationed supply because of law, not because money is debt. Rising house values are also wealth for most households, who own their homes, and mortgage credit widened homeownership. The median new-house series is not adjusted for quality.", refs: ["glaeser_gyourko2018", "jst2017"] },
        { against: "The 'supported' verdict, from the side that finds it too weak", text: "Credit supply demonstrably moves house prices (Favara and Imbs 2015; Mian and Sufi 2011), and falling real rates are themselves an outcome of monetary policy. Wage earners without assets fell behind owners: the median new house took {{house.hours.pay.1973|hrs0}} of production-worker pay in 1973 and {{house.hours.pay.2025|hrs0}} in 2025.", refs: ["favara_imbs2015", "mian_sufi2011", "census_nrs", "bls_ces"] }
      ],
      change: [
        "Toward Partly supported: a constant-quality national index covering more than 50 years that shows no real rise, or evidence that quality and size change explain most of the gap in the median new-house series.",
        "Toward Not supported: a decade-long fall in US and UK house prices relative to consumer prices, as Japan saw after 1991.",
        "The cause, not the trend, would change if natural experiments showed that a rise in credit with fixed supply raises prices little, or that supply reform with unchanged credit lowers them a lot."
      ],
      limits: [
        "The verdict concerns the measured gap between house prices and consumer prices. It does not settle the cause.",
        "The house-price series differ: Census median (new houses, not quality adjusted), FHFA (repeat transactions and appraisals on the same houses, a constant-quality index), Shiller (a compilation of several sources, less comparable before 1953), Land Registry (average price that moves with the mix of properties, a derived series before 1995) and the Canadian builders' index (structure and lot, new houses only). They are not spliced.",
        "The UK real figures depend on the deflator. The RPI is the only UK index back to 1970, but it includes housing costs tied to house prices; the CPI starts in 1988 and is used from 1990. Both are shown where they differ.",
        "No mortgage-rate series ships with this site because of licence terms, so payments relative to income are not computed here."
      ],
      links: [
        { label: "Prices and Purchasing Power: everyday items against homes and land", href: "prices.html" },
        { label: "Debt: household credit and debt service", href: "debt.html" }
      ],
      refs: ["fhfa_hpi", "bls_cpi", "census_nrs", "census_cps", "bls_ces", "hmlr_ukhpi", "ons_rpi", "ons_cpi", "ons_rpi_shortcomings", "bls_oer_1983", "ons_afford2025", "shiller_data", "knoll2017", "statcan_nhpi", "statcan_cpi", "bis_spp", "bls_cpi_home", "money_history", "fred_csushpinsa", "fred_m2sl", "freddie_pmms", "glaeser_gyourko2018", "rachel_smith2015", "favara_imbs2015", "mian_sufi2011", "bls_ap", "jst2017"]
    },

    // ---------------------------------------------------------------- 5
    {
      id: "claim-5", n: 5,
      quick: "Treasury bills after inflation: {{tbill.realavg.cpi.1934.2025p|p2}} a year on average over 1934 to 2025, negative in {{tbill.realneg.cpi.1934.2025p|n0}} of {{tbill.realyears.cpi.1934.2025p|n0}} years, and {{tbill.realreturn.cpi.latest|p2}} over the latest 12 months.",
      claim: "Anyone who takes out loans is stealing from everyone that has money.",
      asked: "Borrowers get money created for them, which dilutes the savings of everyone else.",
      verdict: "Not supported",
      verdictLine: "Not supported as stated. A narrower claim about real returns, surprise inflation and who gets new money first is defensible.",
      text: "A loan creates a deposit and a debt together and takes nothing from anyone's balance, so 'stealing' does not describe the mechanism. Real transfers from savers to debtors do happen when safe returns fall below inflation, and the state, the largest debtor, gains from inflation. Those are narrower claims about returns and timing, and the card sets them out.",
      right: [
        { kind: "trend", text: "Real wealth transfers happen when safe returns fall below inflation, and the offset from expected inflation was only partial in this sample. The 3-month Treasury bill earned a mean real return of {{tbill.realavg.cpi.1934.2025p|p2}} a year over 1934 to 2025 (the 2025 price average uses the eleven months BLS published) and a negative real return in {{tbill.realneg.cpi.1934.2025p|n0}} of those {{tbill.realyears.cpi.1934.2025p|n0}} years. The mean was {{tbill.realavg.cpi.1946.1980|p2}} a year in 1946 to 1980 (negative in {{tbill.realneg.cpi.1946.1980|n0}} of {{tbill.realyears.cpi.1946.1980|n0}} years) and {{tbill.realavg.cpi.2009.2021|p2}} a year in 2009 to 2021. Real returns were {{tbill.realreturn.cpi.2021|p2}} in 2021 and {{tbill.realreturn.cpi.2022|p2}} in 2022. These use the bill's published discount rate, which understates the yield a saver earns by about {{tbill.yieldgap.1934.2025|n2}} points a year on average and by {{tbill.yieldgap.1981.1981|n2}} points in 1981, so the true real returns are slightly higher; all are before tax.", refs: ["fed_h15", "bls_cpi"] },
        { kind: "trend", cited: true, text: "Reinhart and Sbrancia find that real interest rates were negative about half the time in advanced economies in 1945-80, which liquidated government debt by roughly 1 to 5 percent of GDP a year in a 12-country sample (the figures differ across versions of the paper).", refs: ["reinhart_sbrancia2015"] },
        { kind: "trend", cited: true, text: "The FDIC national average savings rate was 0.38 percent on 19 October 2026 against consumer price inflation of 3.74 percent over the year to September 2026, a real return of about -3.4 percent.", refs: ["fdic_rates"] },
        { kind: "trend", cited: true, text: "Inflation does not fall equally on everyone. Jaravel (2019) finds that from 2004 to 2015 retail-goods inflation was 0.661 percentage points a year higher for households in the bottom income fifth than for those in the top fifth.", refs: ["jaravel2019"] },
        { kind: "interpretation", text: "The government, the largest debtor, gains from inflation. New money also reaches some people first (the Cantillon effect): borrowers, bond sellers and the state spend it before prices adjust, banks keep the lending margin, and asset purchases lifted asset prices.", refs: ["doepke_schneider2006", "boe2012_qe"] },
        { kind: "trend", cited: true, text: "The Bank of England found in 2012 that the top 5 percent of UK households held about 40 percent of household financial assets. In the US, the top 1 percent's share of net worth rose from 22.8 percent (1989 Q3) to 32.5 percent (2026 Q2) and the bottom 50 percent's fell from 3.5 to 2.3 percent (Federal Reserve Distributional Financial Accounts).", refs: ["boe2012_qe", "fed_dfa"] }
      ],
      notRight: [
        { kind: "fact", text: "A loan does not reduce anyone's balance: it creates a deposit and a debt together. The borrower spends the deposit and the seller holds it. The borrower owes principal plus interest.", refs: ["boe2014"] },
        { kind: "interpretation", text: "'Theft' is a judgment about fairness, not an accounting term. The borrower and the bank sign the loan voluntarily, and a default falls first on the bank's capital. The claim, though, is about people who signed nothing: holders of money and nominal assets, who can lose through higher prices, and in a crisis the tail losses can reach taxpayers (strain 9).", refs: ["boe2014"] },
        { kind: "trend", text: "Dilution of other holders happens only if total spending outruns supply, and borrowing that builds homes or capital adds supply. M2 rose {{m2.ratio.1971.2025|x1}} from 1971 to 2025 while nominal GDP rose {{gdp.ratio.1971.2025|x1}}, so M2 relative to GDP went from {{m2.share.gdp.1971|p1}} to {{m2.share.gdp.2025|p1}}. On a log scale, about {{m2.logshare.cpi.1971.2025p|p0}} of the growth of M2 is matched by the rise in consumer prices, about {{m2.logshare2.gdp.cpi.1971.2025p|p0}} by the growth of real output (nominal GDP beyond prices) and about {{m2.logshare2.m2.gdp.1971.2025|p0}} by M2 rising faster than GDP (the 2025 price average uses the eleven months published).", refs: ["money_history", "bls_cpi"] },
        { kind: "interpretation", text: "The price part is the part the claim is about. A rise in prices is the loss of purchasing power that holders of money bear, so it cannot count as evidence that no dilution occurred. What the figures do show is that money growth beyond output and prices was small. Holders of market-rate assets were compensated in part (next point).", refs: ["money_history"] },
        { kind: "interpretation", text: "Expected inflation is priced into interest rates, so redistribution comes from surprises and from rates held below inflation. Savers with market-rate instruments earn roughly zero in real terms before tax at present: the 3-month bill rate was {{tbill.latest|p2}} in {{tbill.latestperiod}} against year-on-year consumer price inflation of {{cpi.yoy.latest|p1}}, a real return of {{tbill.realreturn.cpi.latest|p2}} over the 12 months, and annual real returns were {{tbill.realreturn.cpi.2023|p2}} in 2023 and {{tbill.realreturn.cpi.2024|p2}} in 2024. The offset has been partial over the longer record: the mean real return was {{tbill.realavg.cpi.1946.1980|p2}} a year in 1946 to 1980, {{tbill.realavg.cpi.2009.2021|p2}} in 2009 to 2021 and {{tbill.realavg.cpi.2022.2024|p2}} in 2022 to 2024.", refs: ["fed_h15", "bls_cpi"] },
        { kind: "trend", cited: true, text: "The 10-year Treasury yield was 4.99 percent in September 2026 against inflation of 3.74 percent (a real yield of about 1.25 percent), and the 10-year TIPS real yield was 2.64 percent on 22 October 2026.", refs: ["fred_gs10", "fred_dfii10"] },
        { kind: "interpretation", text: "'People who have money' are not one group. Doepke and Schneider find that the main losers from inflation are rich, old bondholders and the main winners are young, middle-class households with fixed-rate mortgages. On this page's own figures, those who hold cash and near-zero deposits are the most exposed (an inference: the page holds no figure for how many households do).", refs: ["doepke_schneider2006"] },
        { kind: "trend", cited: true, text: "Mean real returns over 1870-2015 across 16 economies were about 1 percent on bills, 2.5 percent on bonds and about 7 percent on both housing and equities, so holding real assets historically offset inflation.", refs: ["jknst2019"] }
      ],
      numbers: [
        { label: "Mean real return on 3-month bills, 1934 to 2025", ph: "{{tbill.realavg.cpi.1934.2025p|p2}}" },
        { label: "Years of negative real return, 1934 to 2025", ph: "{{tbill.realneg.cpi.1934.2025p|n0}}" },
        { label: "Years in that count", ph: "{{tbill.realyears.cpi.1934.2025p|n0}}" },
        { label: "Average gap between the bill's investment yield and its discount rate, 1934 to 2025, points", ph: "{{tbill.yieldgap.1934.2025|n2}}", note: "Not included in the real returns above" },
        { label: "Mean real return, 1946 to 1980", ph: "{{tbill.realavg.cpi.1946.1980|p2}}" },
        { label: "Mean real return, 2009 to 2021", ph: "{{tbill.realavg.cpi.2009.2021|p2}}" },
        { label: "Real return, 2021", ph: "{{tbill.realreturn.cpi.2021|p2}}" },
        { label: "Real return, 2022", ph: "{{tbill.realreturn.cpi.2022|p2}}" },
        { label: "Real return, 2023", ph: "{{tbill.realreturn.cpi.2023|p2}}" },
        { label: "Real return, 2024", ph: "{{tbill.realreturn.cpi.2024|p2}}" },
        { label: "3-month bill rate, latest month", ph: "{{tbill.latest|p2}}" },
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" },
        { label: "Real return over the latest 12 months", ph: "{{tbill.realreturn.cpi.latest|p2}}" },
        { label: "M2 relative to GDP, 1971", ph: "{{m2.share.gdp.1971|p1}}" },
        { label: "M2 relative to GDP, 2025", ph: "{{m2.share.gdp.2025|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", text: "How much of the 2009-2021 real-rate suppression was policy choice and how much was a structural fall in the natural rate of interest.", refs: ["rachel_smith2015"] },
        { kind: "interpretation", text: "Whether easy money raises or lowers inequality. Coibion and co-authors (2017) find that contractionary monetary shocks raise inequality, so easing may lower it; Lenza and Slacalek (2018) find that euro-area asset purchases lowered income inequality by cutting unemployment, with minor effects on wealth inequality.", refs: ["coibion2017", "lenza_slacalek2018"] }
      ],
      objection: [
        { against: "The 'not supported' verdict, from the side of the claim", text: "The narrow version is strong. Unexpected inflation and rates below inflation transfer wealth from holders of nominal claims to debtors and the state: bill holders earned {{tbill.realreturn.cpi.2021|p1}} in 2021 and {{tbill.realreturn.cpi.2022|p1}} in 2022 in real terms. Ordinary depositors are least able to buy inflation-indexed bonds or equities, and central banks set short rates, so low real rates are partly a policy choice rather than a market outcome.", refs: ["fed_h15", "reinhart_sbrancia2015"] },
        { against: "The 'not supported' verdict, from the side of the system", text: "Savers are not forced to hold the average account: money-market funds, Treasury bills and competitive online accounts earn near market rates, and with a positive 10-year real yield repression is not the current regime. How far this answers the claim depends on how many households hold such instruments rather than low-rate deposits, and this page has no figure for that share. The postwar repression era also had very few financial crises, and part of the liquidation of debt was inflation that creditors had priced in later. Pensioners and households hold government debt too, so part of the transfer is from savers to themselves as taxpayers.", refs: ["bordo2001", "reinhart_sbrancia2015"] }
      ],
      change: [
        "Toward Partly supported: a measured pattern in which borrowers as a group gain at savers' expense after allowing for what each side expected, in ordinary years and not only in surprise episodes.",
        "Toward Supported in the narrow form: another long stretch of negative real returns on safe assets, like the 1970s, that left ordinary depositors with no practical alternative.",
        "Toward Not supported even in the narrow form: decades of positive real returns on safe assets and a distribution of gains that favours savers over borrowers."
      ],
      limits: [
        "The card tests transfers through real returns on safe assets and asks who gains. It does not value the benefits of credit, and it ignores taxes, which would lower every return shown (the safe-savings tile on this page works one illustration).",
        "The real return is the annual-average bill rate against the change in annual-average CPI-U, measured after the fact, over 1934 to 2025 with the 2025 prices a part year. The bill rate is the published discount rate, which understates the yield (the first statement under What is right gives the size). It is not each saver's own basket or each saver's own account rate.",
        "The savings-rate, yield, wealth-share and long-run return figures are published figures, not recomputed here."
      ],
      links: [
        { label: "Prices and Purchasing Power: real return on savings over time", href: "prices.html" },
        { label: "Debt: who owes what", href: "debt.html" }
      ],
      refs: ["fed_h15", "bls_cpi", "reinhart_sbrancia2015", "fdic_rates", "jaravel2019", "doepke_schneider2006", "boe2012_qe", "fed_dfa", "boe2014", "money_history", "fred_gs10", "fred_dfii10", "jknst2019", "rachel_smith2015", "coibion2017", "lenza_slacalek2018", "bordo2001"]
    },

    // ---------------------------------------------------------------- 6
    {
      id: "claim-6", n: 6,
      quick: "The Federal Reserve's assets went from {{fed.value.2007|usdbn}} at the end of 2007 to {{fed.value.2022|usdbn}} at the end of 2022; US inflation peaked at {{cpi.yoy.2022-06|p2}} in June 2022.",
      claim: "A system where money is simply printed instead of borrowed into existence.",
      asked: "Governments could create the money they need directly, with no matching debt and no interest paid to banks.",
      verdict: "Depends on definition",
      verdictLine: "It depends on the rule. Open-ended discretionary printing has a poor record; rule-bound sovereign money is untested at scale; central-bank asset purchases are already part of the current system but are not the same as printing to pay for spending.",
      text: "'Printing' covers at least three different designs: open-ended issue by the state, a rule-bound sovereign-money system, and central-bank asset purchases of the kind that already happen. The evidence differs for each, so one verdict cannot cover them all.",
      right: [
        { kind: "fact", text: "Money creation does not logically require private borrowing. Central banks already create money without a borrower: the Federal Reserve's balance sheet went from {{fed.value.2007|usdbn}} at the end of 2007 to {{fed.value.2022|usdbn}} at the end of 2022.", refs: ["money_history"] },
        { kind: "trend", cited: true, text: "The 2020-22 episode is the nearest recent test. Only about $0.81 trillion of a $6.30 trillion rise in M2 matched growth in bank loans. Inflation then peaked in June 2022 and fell. M2 also fell 4.8 percent (March 2022 to October 2023), but the federal funds rate rose by about 5 points (0.20 percent in March 2022 to 5.33 percent in August 2023) and supply pressures eased in the same months, so the fall in inflation cannot be credited to the fall in M2 alone. There was no hyperinflation.", refs: ["fred_m2sl", "fred_h8", "fred_fedfunds"] },
        { kind: "trend", text: "US consumer price inflation was {{cpi.yoy.2022-06|p2}} in the year to June 2022, the highest reading since 1981, and {{cpi.yoy.latest|p1}} in the year to {{cpi.latestperiod}}.", refs: ["bls_cpi"] },
        { kind: "trend", cited: true, text: "The IMF's Chicago Plan study (Benes and Kumhof 2012) models 100 percent reserve banking, where money creation no longer requires debt creation. It finds sharp falls in public and private debt, output gains approaching 10 percent and zero steady-state inflation.", refs: ["benes_kumhof2012"] },
        { kind: "interpretation", text: "A rule-bound sovereign-money design would also move the profit from creating money from banks to the public. So 'the current credit system is the only possible one' is not supported.", refs: ["benes_kumhof2012", "sigurjonsson2015"] }
      ],
      notRight: [
        { kind: "trend", cited: true, text: "'Print whenever you want' is the weakest version. Hanke and Krus catalogue 56 hyperinflation episodes (monthly inflation above 50 percent); money printing to finance deficits during war, collapse or political disintegration was the common thread. Fischer, Sahay and Vegh find across 133 countries that in high-inflation countries the fiscal balance and seigniorage are strongly related.", refs: ["hanke_krus2012", "fischer_sahay_vegh2002"] },
        { kind: "interpretation", cited: true, text: "Sargent (1982) finds that Austria, Hungary, Poland and Germany all financed enormous deficits by creating money, and that all four inflations ended almost overnight through once-and-for-all fiscal reform.", refs: ["sargent1982"] },
        { kind: "trend", cited: true, text: "The 100 percent reserve result is a model with calibrated assumptions that has never been run on a large economy. Switzerland's 2018 sovereign-money initiative was rejected 75.7 percent to 24.3 percent. Iceland's 2015 government report said sovereign money could be a basis for reform but required further study.", refs: ["benes_kumhof2012", "bloomberg_swiss2018", "sigurjonsson2015"] },
        { kind: "interpretation", text: "Printing does not remove the question every system must answer: who gets the new money first and what stops it being over-issued. In the credit system the brakes are borrower solvency, bank capital rules and the policy rate. In a printing system with no fixed rule the only brake is political.", refs: ["mankiw2020"] },
        { kind: "trend", text: "Even in 2020-22, central-bank and deficit money was followed by US inflation of {{cpi.yoy.2022-06|p2}} (June 2022), though economists dispute how much of that was money (see below).", refs: ["bls_cpi"] }
      ],
      numbers: [
        { label: "Federal Reserve total assets, end of 2007", ph: "{{fed.value.2007|usdbn}}" },
        { label: "Federal Reserve total assets, end of 2020", ph: "{{fed.value.2020|usdbn}}" },
        { label: "Federal Reserve total assets, end of 2022", ph: "{{fed.value.2022|usdbn}}" },
        { label: "Federal Reserve total assets, end of 2025", ph: "{{fed.value.2025|usdbn}}" },
        { label: "Federal Reserve assets, % of GDP, 2020", ph: "{{fed.share.gdp.2020|p1}}" },
        { label: "Federal Reserve assets, % of GDP, 2025", ph: "{{fed.share.gdp.2025|p1}}" },
        { label: "US M2 growth per year, 1971 to 2025", ph: "{{m2.cagr.1971.2025|p2}}" },
        { label: "Consumer prices, year on year, June 2022", ph: "{{cpi.yoy.2022-06|p2}}" },
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" },
        { label: "Consumer prices since February 2020", ph: "{{cpi.pct.2020-02.latest|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", cited: true, text: "How much of the 2021-22 inflation was money. Jorda and co-authors attribute about 3 points of US excess inflation to fiscal support, while Bernanke and Blanchard find that most of the 2021 surge came from shocks to prices given wages.", refs: ["jorda_liu2022", "bernanke_blanchard2023"] },
        { kind: "interpretation", text: "Whether central-bank independence plus an inflation target is a sufficient brake, whether asset purchases count as 'printing', and whether sovereign money would reduce credit cycles (Benes and Kumhof say yes in their model, which is a prediction, not a measurement).", refs: ["benes_kumhof2012", "mankiw2020"] },
        { kind: "interpretation", cited: true, text: "Whether a government that borrows in its own currency faces any financial constraint. In a 2019 survey of 38 US economists, none agreed that such a country 'can always create money to finance its debt' without worry, while Modern Monetary Theory authors say the binding limit is real resources and inflation, not solvency.", refs: ["igm_mmt2019", "mankiw2020"] }
      ],
      objection: [
        { against: "The 'depends on definition' verdict, from the sceptical side", text: "Saying it depends can hide that the design closest to the claim as worded, money issued to pay for spending with no matching debt and no fixed rule, has the worst record in the data: the large cases of money collapse (Weimar Germany, Zimbabwe, Venezuela, the Confederacy) all coincided with war, default or lost market access. Small, time-limited issues such as the Union greenbacks were survivable and later restored to par.", refs: ["hanke_krus2012", "sargent1982", "grubb2011", "weidenmier2002"] },
        { against: "The 'depends on definition' verdict, from the side of the claim", cited: true, text: "Hyperinflations are rare, about 56 over centuries and almost all tied to war or collapse. Advanced economies financed large deficits through asset purchases in 2008-2019 without runaway inflation, so 'central-bank financing means hyperinflation' is too strong. Sovereign-money advocates propose an independent committee that decides issuance, which is not the same as printing whenever you want. The Swiss rejection tells us about voters' risk tolerance, not about the economics.", refs: ["hanke_krus2012", "sigurjonsson2015", "bloomberg_swiss2018"] }
      ],
      change: [
        "A real-world full-reserve or sovereign-money system run at national scale for a decade, with measured inflation, credit and crisis outcomes, would replace model results with evidence and could move the verdict either way.",
        "A rule-bound design that restrained issuance under fiscal stress would move the verdict toward Partly supported; a repeat of the 2020-22 pattern (large money growth, then high inflation, without offsetting supply shocks) would move it toward the critics.",
        "Settling how much of the 2021-22 inflation was monetary and how much was supply would sharpen the verdict on the nearest recent test."
      ],
      limits: [
        "This card compares designs by historical episodes, one modelling study and one referendum. None of the cases is a controlled experiment, and the large printing episodes coincided with war, default or political collapse.",
        "Hyperinflation data are unreliable by nature: official statistics stopped in Zimbabwe and Venezuela, and some peaks come from secondary reproductions.",
        "The M2, bank-loan and episode figures are published figures, not recomputed here."
      ],
      links: [
        { label: "Money Flow: how money is created", href: "money-flow.html" },
        { label: "Money Over Time: 770 years of money", href: "monetary-history.html#v=history" },
        { label: "Money systems compared", href: "index.html#systems" }
      ],
      refs: ["money_history", "fred_m2sl", "fred_h8", "fred_fedfunds", "bls_cpi", "benes_kumhof2012", "sigurjonsson2015", "hanke_krus2012", "fischer_sahay_vegh2002", "sargent1982", "bloomberg_swiss2018", "mankiw2020", "jorda_liu2022", "bernanke_blanchard2023", "igm_mmt2019", "grubb2011", "weidenmier2002"]
    },

    // ---------------------------------------------------------------- 7
    {
      id: "claim-7", n: 7,
      quick: "US consumer prices changed by {{cpi.pct.1929.1933|p1}} from 1929 to 1933 on the gold exchange standard and by {{cpi.pct.1933.1937|p1}} from 1933 to 1937, after the US left gold.",
      claim: "Tying money to gold made the 1930s worse.",
      asked: "A hard link to gold forced central banks to tighten into the Depression, and the countries that left gold sooner recovered sooner, so a gold anchor is a poor safeguard. This is a proposition made in defence of the current system, tested the same way as the others.",
      verdict: "Supported",
      verdictLine: "Supported for the interwar gold exchange standard. It does not test the classical gold standard, and economists dispute how much of the US contraction came from gold itself rather than from Federal Reserve policy.",
      text: "The cross-country record of the 1930s is among the best-replicated results in macroeconomic history: countries that left gold earlier recovered earlier. What it shows is narrower than 'gold is a bad anchor'. It concerns the interwar gold exchange standard, which central banks ran differently from the classical standard, and the cause of the US contraction is disputed.",
      right: [
        { kind: "trend", cited: true, text: "Across 24 countries in 1929-36, those that stayed on gold longer had deeper depressions, and the countries that left early (the UK in September 1931, the US in 1933-34) recovered earlier (Bernanke and James 1991; Eichengreen and Sachs 1985).", refs: ["bernanke_james1991", "eichengreen_sachs1985"] },
        { kind: "trend", text: "US consumer prices changed by {{cpi.pct.1929.1933|p1}} from 1929 to 1933 (annual averages), an average of {{cpi.cagr.1929.1933|p2}} a year. After the US left gold in 1933 they changed by {{cpi.pct.1933.1937|p1}} from 1933 to 1937.", refs: ["bls_cpi"] },
        { kind: "trend", text: "UK retail prices changed by {{ukrpia.pct.1925.1931|p1}} from 1925 to 1931 on gold and by {{ukrpia.pct.1931.1937|p1}} from 1931, the year Britain left gold, to 1937: the fall stopped.", refs: ["ons_rpi"] },
        { kind: "trend", cited: true, text: "The US money stock fell nearly 30 percent between fall 1930 and winter 1933.", refs: ["fedhist_great_depression"] },
        { kind: "interpretation", text: "The mechanism: a central bank that loses gold or cannot defend the parity must raise rates or shrink credit, or leave gold. In a slump that forces tightening when the economy needs easing, and deflation raises the real burden of debts fixed in money.", refs: ["bernanke_james1991", "fisher1933"] }
      ],
      notRight: [
        { kind: "interpretation", cited: true, text: "How much of the US contraction came from gold itself is disputed. Friedman and Schwartz trace it to Federal Reserve policy errors and bank failures, and the Federal Reserve and the Bank of France sterilised gold inflows (see the interwar card), so the US was not simply forced to tighten by a shortage of gold.", refs: ["friedman_schwartz1963", "fedhist_great_depression"] },
        { kind: "interpretation", text: "The interwar system was not the classical gold standard. Reserves were increasingly held as foreign exchange rather than metal, the commitment to gold was less credible than before 1914, and the 'rules of the game' were not followed. The classical standard of 1870-1914 had near-zero average inflation and a mean-reverting price level, though more output volatility than the post-1970 float (see the gold standard card).", refs: ["basu_taylor1999", "bordo_econlib", "bordo_nber1999"] },
        { kind: "interpretation", cited: true, text: "The Austrian school locates the cause earlier. It argues that the slump was the correction of a credit boom in the 1920s that the Federal Reserve fed, and that attempts to prevent the correction prolonged it (Rothbard 1963).", refs: ["rothbard1963"] },
        { kind: "trend", cited: true, text: "Leaving gold was not the only change. The US exit came with a banking holiday, deposit insurance from 1934 and a devaluation of about 41 percent (the gold price went from $20.67 to $35 an ounce), so the effect of the exit alone cannot be isolated.", refs: ["fedhist_gold_reserve", "fdic_90years"] }
      ],
      numbers: [
        { label: "US consumer prices, 1929 to 1933", ph: "{{cpi.pct.1929.1933|p1}}" },
        { label: "The same as an average a year", ph: "{{cpi.cagr.1929.1933|p2}}" },
        { label: "US consumer prices, 1933 to 1937", ph: "{{cpi.pct.1933.1937|p1}}" },
        { label: "UK retail prices, 1925 to 1931 (on gold)", ph: "{{ukrpia.pct.1925.1931|p1}}" },
        { label: "UK retail prices, 1931 to 1937 (after leaving gold)", ph: "{{ukrpia.pct.1931.1937|p1}}" },
        { label: "US consumer prices, annual rate, 1972 to 1982 (floating money)", ph: "{{cpi.cagr.1972.1982|p2}}" }
      ],
      disagree: [
        { kind: "interpretation", cited: true, text: "How much of the 1929-33 contraction was monetary and how much came from other shocks. Friedman and Schwartz stress monetary policy and bank failures; the Austrian view stresses the 1920s credit boom; Bernanke and James stress the transmission of deflation through the gold link.", refs: ["friedman_schwartz1963", "rothbard1963", "bernanke_james1991"] },
        { kind: "interpretation", text: "Whether the lessons of the 1930s apply to a gold standard run on classical rules, to 100 percent gold reserves or to free banking, none of which operated at national scale through a depression.", refs: ["basu_taylor1999", "selgin_white1994"] }
      ],
      objection: [
        { against: "The 'supported' verdict, from the side of the sound-money critic", text: "The 1930s tested a system that its own supporters say had already been abandoned in practice: central banks sterilised gold, the rules were not followed, and war debts and reparations had distorted the flows. Judging gold by the years in which it was not followed is unfair to the rule, and floating money has had its own failures: US prices rose {{cpi.cagr.1972.1982|p2}} a year from 1972 to 1982.", refs: ["fedhist_great_depression", "fedhist_great_inflation", "bls_cpi"] },
        { against: "The 'supported' verdict, from the side that finds it too weak", text: "Gold's costs show up outside the 1930s. Output was more volatile under the classical standard than under the post-1970 float, the standard was suspended in every major war, and money followed mining rather than output, which produced the long deflation of the 1870s to 1890s. No major country returned to gold after the Depression.", refs: ["basu_taylor1999", "bordo_econlib"] }
      ],
      change: [
        "Toward Partly supported: evidence that countries off gold did no better once banking crises and the policy mix are controlled for, or that the US contraction would have happened on a floating exchange rate.",
        "Toward Not supported: evidence that the depth of the depression in the gold-bloc countries came from domestic credit and fiscal policy rather than from the gold link.",
        "A test of the classical standard or of 100 percent reserves through a major slump would answer a different claim from this one."
      ],
      limits: [
        "This card tests the interwar gold exchange standard in 1929-36, mostly through published cross-country studies. It does not test the classical gold standard before 1914, 100 percent gold reserves or free banking.",
        "The cross-country and money-stock figures are published figures, not recomputed here. The US and UK price changes are computed from annual averages.",
        "Causal statements about the 1930s are contested: countries that left gold at different dates differ in much else."
      ],
      links: [
        { label: "Money systems compared: the interwar gold exchange standard", href: "index.html#sys-interwar" },
        { label: "Money Over Time: the dollar and gold", href: "monetary-history.html#v=history" }
      ],
      refs: ["bernanke_james1991", "eichengreen_sachs1985", "bls_cpi", "ons_rpi", "fedhist_great_depression", "fedhist_gold_reserve", "fedhist_great_inflation", "fdic_90years", "friedman_schwartz1963", "rothbard1963", "basu_taylor1999", "bordo_econlib", "bordo_nber1999", "fisher1933", "selgin_white1994"]
    },

    // ---------------------------------------------------------------- 8
    {
      id: "claim-8", n: 8,
      quick: "At two percent a year prices double in {{calc.doubling_from_rate.2|yrs1}}. US consumer prices rose {{cpi.cagr.1990.2007|p2}} a year over 1990 to 2007, {{cpi.cagr.2008.2019|p2}} over 2008 to 2019 and {{cpi.cagr.2020.2024|p2}} over 2020 to 2024.",
      claim: "Two percent inflation a year is about the right amount.",
      asked: "A little steady inflation keeps prices flexible and keeps the economy away from deflation, so a two percent goal is a sensible price for stability. This is a proposition made in defence of the current system, tested the same way as the others.",
      verdict: "Partly supported",
      verdictLine: "Low and stable inflation has a good record since the 1990s, and the deflation of the 1930s shows the cost of the alternative. The record does not show that two is better than one or four, and actual inflation has been above and below two.",
      text: "The goal of two percent is a judgment about trade-offs, so this card tests what can be measured: how stable inflation was once targets were adopted, what two percent means for a dollar, how far actual inflation has been from two, and what deflation looked like when it came. The Federal Reserve defines its goal on the PCE price index, which has run about half a point a year below the CPI-U that this page uses (claim 3), so CPI-U figures above two do not by themselves mean the goal was missed.",
      right: [
        { kind: "trend", cited: true, text: "Inflation was most stable in the G7 in 1993-2007, the years of inflation targets: the standard deviation of annual inflation was 0.72 points, against 4.15 points in 1971-89 (World Bank data, computed in the research).", refs: ["wdi_cpi_growth"] },
        { kind: "trend", text: "US consumer prices rose {{cpi.cagr.1993.2007|p2}} a year from 1993 to 2007 and {{cpi.cagr.2008.2019|p2}} a year from 2008 to 2019, against {{cpi.cagr.1971.1989|p2}} a year from 1971 to 1989.", refs: ["bls_cpi"] },
        { kind: "trend", text: "Deflation has a record. US consumer prices changed by {{cpi.pct.1929.1933|p1}} from 1929 to 1933, and the year-on-year rate was {{cpi.yoy.2009-07|p1}} in July 2009.", refs: ["bls_cpi"] },
        { kind: "interpretation", text: "With a positive goal the central bank has more room to cut real interest rates in a slump before the policy rate reaches zero, and falling prices raise the real burden of debts fixed in money (Fisher 1933).", refs: ["fed_inflation_goal", "fisher1933"] },
        { kind: "fact", text: "At two percent a year prices double in {{calc.doubling_from_rate.2|yrs1}}.", refs: ["fed_inflation_goal"] }
      ],
      notRight: [
        { kind: "trend", text: "Actual inflation has not stayed at two. US consumer prices rose {{cpi.cagr.1990.2007|p2}} a year over 1990 to 2007, {{cpi.cagr.2008.2019|p2}} over 2008 to 2019 and {{cpi.cagr.2020.2024|p2}} over 2020 to 2024, and {{cpi.yoy.latest|p1}} in the year to {{cpi.latestperiod}} (CPI-U, which runs above the PCE index the goal refers to).", refs: ["bls_cpi", "fed_inflation_goal"] },
        { kind: "trend", text: "The cost of any positive rate compounds. A dollar of 1990 kept {{cpi.power.1990.2024|p1}} of its buying power in 2024, and a dollar of August 1971 keeps {{cpi.power.1971-08.latest|p1}} of it now.", refs: ["bls_cpi"] },
        { kind: "interpretation", cited: true, text: "Nothing in the data singles out two. Ball and Sheridan find no clear effect of inflation targeting itself once regression to the mean is allowed for. Economists have argued for a higher goal, about four percent, to leave more room at the zero bound (Blanchard, Dell'Ariccia and Mauro 2010), and for price stability, because inflation distorts a tax system that is not indexed (Feldstein 1997).", refs: ["ball_sheridan2003", "blanchard_dell_ariccia_mauro2010", "feldstein1997"] },
        { kind: "interpretation", text: "The costs of inflation fall unevenly. Doepke and Schneider find that the main US losers are rich, old bondholders and the main winners young households with fixed-rate mortgages, and savers with low-rate deposits lose in real terms (claim 5).", refs: ["doepke_schneider2006"] }
      ],
      numbers: [
        { label: "Years to double at two percent a year", ph: "{{calc.doubling_from_rate.2|yrs1}}" },
        { label: "US consumer prices a year, 1971 to 1989", ph: "{{cpi.cagr.1971.1989|p2}}" },
        { label: "The same, 1990 to 2007", ph: "{{cpi.cagr.1990.2007|p2}}" },
        { label: "The same, 1993 to 2007", ph: "{{cpi.cagr.1993.2007|p2}}" },
        { label: "The same, 2008 to 2019", ph: "{{cpi.cagr.2008.2019|p2}}" },
        { label: "The same, 2020 to 2024", ph: "{{cpi.cagr.2020.2024|p2}}" },
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" },
        { label: "A dollar of 1990 keeps, in 2024", ph: "{{cpi.power.1990.2024|p1}}" },
        { label: "US consumer prices, 1929 to 1933", ph: "{{cpi.pct.1929.1933|p1}}" }
      ],
      disagree: [
        { kind: "interpretation", text: "Whether the goal should be higher, lower or a range, and whether a price-level target that corrects overshoots would be better than a rate target that lets them stand (see claim 3 and strain 7).", refs: ["ball_sheridan2003", "stock_watson2002"] },
        { kind: "interpretation", text: "Which price index the goal should use. The PCE index that the Federal Reserve targets runs about half a point a year below the CPI-U (claim 3), so the same outcome can be above or below two depending on the index.", refs: ["fed_inflation_goal", "bea_pce"] }
      ],
      objection: [
        { against: "The 'partly supported' verdict, from the side of the claim", text: "The record since 1990 is the best argument: low and stable inflation, no return to the 1970s and a deflation scare that was met. The undershoot of {{cpi.cagr.2008.2019|p2}} in 2008-2019 and the overshoot of 2021-23 are the kind of misses a target tolerates, and part of the gap above two on the CPI-U reflects the difference between that index and the PCE index.", refs: ["wdi_cpi_growth", "bls_cpi", "bea_pce"] },
        { against: "The 'partly supported' verdict, from the other side", text: "A goal that is missed by a point in both directions is a weak anchor, and the price level has risen {{cpi.ratio.1990.2024|x1}} since 1990 with no step back. A rule that corrected overshoots would give savers and wage-setters a predictable price level; a two percent drift is a rate chosen by officials and not a measurement of what is right.", refs: ["bls_cpi", "ball_sheridan2003"] }
      ],
      change: [
        "Toward Supported: evidence that inflation expectations stayed anchored at two through 2021-23 without a large loss of output, and that a lower goal would have meant longer or more frequent spells at the zero bound.",
        "Toward Not supported: evidence that one percent or zero would have given the same stability at lower cost, or that four percent would have avoided the zero-bound years without unsettling expectations.",
        "A different price index (CPI-U or PCE) shifts every figure here; the verdict would change if the gap between the two were large enough to move 2008-2019 or 2020-2024 across two."
      ],
      limits: [
        "Consumer prices only (CPI-U). The goal is set on the PCE index, which this site does not hold.",
        "This card cannot test the counterfactuals in the list above. The stability figures are published figures from World Bank data.",
        "A value judgment sits underneath: how much weight to give savers, borrowers and the risk of deflation."
      ],
      links: [
        { label: "Prices and Purchasing Power: the doubling-time calculator", href: "prices.html" },
        { label: "Strains: price-level drift and inflation credibility", href: "index.html#strain-7" }
      ],
      refs: ["fed_inflation_goal", "bls_cpi", "wdi_cpi_growth", "ball_sheridan2003", "stock_watson2002", "fisher1933", "doepke_schneider2006", "bea_pce", "blanchard_dell_ariccia_mauro2010", "feldstein1997"]
    }
  ],

  fragilitiesIntro: {
    title: "Where pressure shows up",
    intro: "Ten places where measured pressure shows up, each with the metric, the current reading, why it matters, the counterpoint and what the counterpoint leaves out. A short panel after the cards shows where the system has held. The list has no ranking and no score, and a strain is not a prediction of failure. Where a reading depends on a projection, it is marked as one.",
    note: "Readings marked 'computed' are calculated from the data files with their period and source. Readings marked 'published' are quoted from the cited source and were not recomputed here."
  },

  // Not every measure shows pressure. These readings come from data already on the page and are shown after the ten strains.
  fragilitiesHeld: {
    title: "Where the system has held",
    intro: "Not every measure shows pressure. These readings use data already on this page. Like the strains, they describe a period and are not a prediction.",
    items: [
      { kind: "trend", cited: true, text: "Inflation was most stable in the G7 sample in 1993-2007: the standard deviation of annual inflation was 0.72 points, against 4.15 points in 1971-89 (World Bank data, computed in the research).", refs: ["wdi_cpi_growth"] },
      { kind: "trend", cited: true, text: "The FDIC says no insured depositor has lost money in an insured bank since the FDIC began in 1934.", refs: ["fdic_90years"] },
      { kind: "trend", text: "US household plus company credit fell from {{hhus.plus.nfcus.2008|p1}} of GDP at the end of 2008 to {{hhus.plus.nfcus.2025|p1}} at the end of 2025 (government credit rose; see strain 4), and the household debt service ratio fell from {{dsrhhus.value.2007|p1}} of income in 2007 to {{dsrhhus.value.2025|p1}} in 2025.", refs: ["bis_tc", "bis_dsr"] },
      { kind: "trend", text: "For the US in 2024 the effective interest rate on government debt was below nominal growth, by {{usie.rmg.usd.usg.2024|sgn2}} points on the IMF basis, and net interest was {{usnetint.share.usgdpfy.2025|p2}} of GDP in fiscal 2025, the same share as in fiscal 1991.", refs: ["imf_pfmh", "omb_hist", "treasury_mts"] },
      { kind: "trend", cited: true, text: "US household net worth was 6.0 times GDP in 2026 Q2 against 3.3 times in 1980.", refs: ["fred_tnwbshno"] }
    ]
  },

  fragilities: [
    // ---------------------------------------------------------------- 1
    {
      id: "strain-1", n: 1, name: "Federal interest burden",
      why: { kind: "interpretation", text: "Interest is the price of past borrowing and is paid before new spending choices. When rates reset upward on a large debt, the bill rises with a lag and either crowds out other spending or adds to borrowing." },
      metric: "Net interest outlays in dollars, as a share of GDP and of federal receipts; the average interest rate on Treasury debt; interest compared with other budget lines.",
      reading: [
        { label: "Net interest outlays, fiscal 2021, $ billion", ph: "{{usnetint.value.2021|n0}}" },
        { label: "Net interest outlays, fiscal 2024, $ billion", ph: "{{usnetint.value.2024|n0}}" },
        { label: "Net interest outlays, fiscal 2026, $ billion", ph: "{{usnetint.value.2026|n0}}" },
        { label: "Net interest as % of federal receipts, fiscal 2021", ph: "{{usnetint.share.usrcpt.2021|p1}}" },
        { label: "The same, fiscal 2026", ph: "{{usnetint.share.usrcpt.2026|p1}}" },
        { label: "The same, fiscal 2015", ph: "{{usnetint.share.usrcpt.2015|p1}}" },
        { label: "The same, fiscal 1991 (the earlier peak)", ph: "{{usnetint.share.usrcpt.1991|p1}}" },
        { label: "Net interest as % of GDP, fiscal 2025", ph: "{{usnetint.share.usgdpfy.2025|p1}}" },
        { label: "The same, fiscal 1991", ph: "{{usnetint.share.usgdpfy.1991|p1}}" },
        { label: "Debt held by the public, % of GDP, fiscal 1991", ph: "{{uspublic.value.1991|p1}}" },
        { label: "The same, fiscal 2025", ph: "{{uspublic.value.2025|p1}}" },
        { label: "Effective rate (net interest over debt held by the public at the end of the year before), fiscal 1991", ph: "{{usnetint.effratefy.uspublic.usgdpfy.1991|p2}}" },
        { label: "The same, fiscal 2025", ph: "{{usnetint.effratefy.uspublic.usgdpfy.2025|p2}}" },
        { label: "Net interest as % of GDP if the average Treasury rate returned to its 2007 level on the same debt (an illustration)", ph: "{{usnetint.atrate.usgdpfy.usrate.2025.2007|p1}}", note: "Fiscal 2025 interest scaled by the 2007 average rate over the 2025 average rate (calendar-year means); not a forecast" },
        { label: "The same at the 2001 average rate", ph: "{{usnetint.atrate.usgdpfy.usrate.2025.2001|p1}}" },
        { label: "Average rate on interest-bearing debt, 2021", ph: "{{usrate.value.2021|p2}}", note: "Mean of the twelve month-end rates" },
        { label: "The same, 2025", ph: "{{usrate.value.2025|p2}}" },
        { label: "Total public debt outstanding, end of September 2026", ph: "{{usdebt.inbn.2026|usdbn}}" }
      ],
      published: [
        { kind: "trend", cited: true, text: "Net interest passed national defence outlays in fiscal 2024. Defence outlays were $754.8 billion in fiscal 2021, $874.0 billion in 2024, $916.6 billion in 2025 and $965.2 billion in 2026 (Monthly Treasury Statement, Table 9).", refs: ["treasury_mts"] },
        { kind: "trend", cited: true, projection: true, text: "Projection: CBO projects net interest at 3.3 percent of GDP in 2026, rising to 4.6 percent in 2036 (as summarised by the House Budget Committee staff; secondhand, because the CBO page could not be opened).", refs: ["cbo_via_hbc"] },
        { kind: "trend", cited: true, text: "Total public debt was $40.44 trillion on 22 October 2026, $32.60 trillion of it held by the public.", refs: ["treasury_dttp"] }
      ],
      counterpoint: { kind: "interpretation", text: "Interest is a transfer to bondholders (households, pensions, foreigners), not resources destroyed, although the part paid to foreign holders leaves the domestic economy. As a share of GDP net interest was {{usnetint.share.usgdpfy.2025|p2}} in fiscal 2025, the same as the {{usnetint.share.usgdpfy.1991|p2}} of fiscal 1991, and it was a small share of GDP in 2010 with a large debt, so the burden is driven by the rate regime, which can fall again. Post-war and Japanese experience show high debt carried at low rates. The sustainability measure is the interest rate minus growth together with the primary balance, not the interest bill alone.", refs: ["blanchard2019"] },
      leaves: { kind: "trend", text: "The same share of GDP now rests on debt held by the public of {{uspublic.value.2025|p1}} of GDP, against {{uspublic.value.1991|p1}} in 1991, at an effective rate of {{usnetint.effratefy.uspublic.usgdpfy.2025|p2}} against {{usnetint.effratefy.uspublic.usgdpfy.1991|p2}}. As a share of receipts it is {{usnetint.share.usrcpt.2026|p1}} in fiscal 2026, above the {{usnetint.share.usrcpt.1991|p1}} of 1991. The rate regime can rise as well as fall: on the same debt, the 2007 average rate would give about {{usnetint.atrate.usgdpfy.usrate.2025.2007|p1}} of GDP and the 2001 rate about {{usnetint.atrate.usgdpfy.usrate.2025.2001|p1}}, and the projection above puts net interest at 4.6 percent of GDP by 2036.", refs: ["omb_hist", "treasury_mts", "treasury_avg_rates", "cbo_via_hbc"] },
      links: [{ label: "Debt: interest cost", href: "debt.html" }],
      refs: ["omb_hist", "treasury_mts", "treasury_avg_rates", "treasury_hdo", "treasury_dttp", "cbo_via_hbc", "blanchard2019"]
    },

    // ---------------------------------------------------------------- 2
    {
      id: "strain-2", n: 2, name: "Public debt level, and the shift from private to public",
      why: { kind: "interpretation", text: "Governments absorb private losses after crises, so debts that were once private (mortgages, banks) can become taxpayer liabilities. High debt also reduces room to respond to the next shock." },
      metric: "General government gross debt as a share of GDP by country; household, corporate and government credit as a share of GDP (BIS and IMF).",
      readingTable: {
        title: "General government gross debt, % of GDP (IMF World Economic Outlook)",
        note: "The newest year is the IMF's latest figure in the October 2026 vintage and may be an estimate. Gross debt includes debt that one part of government owes another; net figures are smaller (see the glossary).",
        columns: ["2007", "2025"],
        rows: [
          { label: "United States", cells: ["{{wus.value.2007|p1}}", "{{wus.value.2025|p1}}"] },
          { label: "Japan", cells: ["{{wjp.value.2007|p1}}", "{{wjp.value.2025|p1}}"] },
          { label: "United Kingdom", cells: ["{{wgb.value.2007|p1}}", "{{wgb.value.2025|p1}}"] },
          { label: "Germany", cells: ["{{wde.value.2007|p1}}", "{{wde.value.2025|p1}}"] },
          { label: "France", cells: ["{{wfr.value.2007|p1}}", "{{wfr.value.2025|p1}}"] },
          { label: "Italy", cells: ["{{wit.value.2007|p1}}", "{{wit.value.2025|p1}}"] },
          { label: "Canada", cells: ["{{wca.value.2007|p1}}", "{{wca.value.2025|p1}}"] },
          { label: "China", cells: ["{{wcn.value.2007|p1}}", "{{wcn.value.2025|p1}}"] }
        ]
      },
      reading: [
        { label: "US household credit, % of GDP, end of 2007", ph: "{{hhus.value.2007|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.value.2025|p1}}" },
        { label: "US government credit, % of GDP, end of 2007", ph: "{{ggus.value.2007|p1}}" },
        { label: "The same, end of 2025", ph: "{{ggus.value.2025|p1}}" }
      ],
      published: [
        { kind: "trend", cited: true, text: "Global debt was just above 235 percent of world GDP in 2024 ($251 trillion): public debt $99.2 trillion (nearly 93 percent of GDP) and private debt $151.8 trillion (under 143 percent, the lowest since 2015).", refs: ["imf_global_debt2025"] },
        { kind: "trend", cited: true, projection: true, text: "Projection: the IMF Fiscal Monitor of April 2026 puts global public debt near 94 percent of GDP in 2025 and 100 percent by 2029 (secondhand; not re-checked).", refs: ["imf_fiscal_monitor_2026"] }
      ],
      counterpoint: { kind: "interpretation", cited: true, text: "Debts are also assets: US household net worth was $195.9 trillion, 6.0 times GDP, in 2026 Q2 against 3.3 times in 1980. There is no reliable debt-to-GDP threshold: the original 90 percent cliff of Reinhart and Rogoff did not survive correction. Herndon, Ash and Pollin (2014) find average growth of 2.2 percent a year above 90 percent debt, not the -0.1 percent first reported, though still below the 3.1 to 4.2 percent of the lower-debt bands, and whether debt causes slower growth is disputed. Demand for safe assets lets governments borrow cheaply (Blanchard 2019), and Japan has carried more than 200 percent for years at low rates.", refs: ["fred_tnwbshno", "herndon_ash_pollin2014", "blanchard2019"] },
      leaves: { kind: "trend", cited: true, text: "Aggregate net worth says little about who carries the debt. The top 1 percent of US households hold 32.5 percent of net worth and the bottom 50 percent hold 2.3 percent (Federal Reserve Distributional Financial Accounts, 2026 Q2), so the assets that offset public and private debt are not held by the people whose taxes or incomes service it.", refs: ["fed_dfa"] },
      links: [{ label: "Debt: debt by sector and country", href: "debt.html" }],
      refs: ["imf_weo", "bis_tc", "imf_global_debt2025", "imf_fiscal_monitor_2026", "fred_tnwbshno", "herndon_ash_pollin2014", "blanchard2019"]
    },

    // ---------------------------------------------------------------- 3
    {
      id: "strain-3", n: 3, name: "The margin between interest rate and growth (r minus g)",
      why: { kind: "interpretation", text: "Whether debt relative to GDP snowballs depends on the gap between the interest rate on debt and nominal growth. A negative gap makes high debt cheap to carry and a positive gap makes it self-reinforcing." },
      metric: "The effective interest rate on government debt (interest paid over the previous year's debt, adjusted for growth) minus nominal GDP growth, together with the primary balance.",
      readingTable: {
        title: "United States: effective interest rate, nominal growth and the gap (IMF)",
        note: "General government where the IMF has it, central government otherwise; the coverage changed in 1960. Positive gap means debt relative to GDP rises on its own. The Debt page also works this on the US federal budget basis (net interest over debt held by the public, fiscal years), which gives a different figure for a different period; the two bases are not interchangeable.",
        columns: ["Effective rate, %", "Nominal growth, %", "Gap, points"],
        rows: [
          { label: "1975", cells: ["{{usie.effrate.usd.usg.1975|n2}}", "{{usg.value.1975|n2}}", "{{usie.rmg.usd.usg.1975|sgn2}}"] },
          { label: "1981", cells: ["{{usie.effrate.usd.usg.1981|n2}}", "{{usg.value.1981|n2}}", "{{usie.rmg.usd.usg.1981|sgn2}}"] },
          { label: "1990", cells: ["{{usie.effrate.usd.usg.1990|n2}}", "{{usg.value.1990|n2}}", "{{usie.rmg.usd.usg.1990|sgn2}}"] },
          { label: "2000", cells: ["{{usie.effrate.usd.usg.2000|n2}}", "{{usg.value.2000|n2}}", "{{usie.rmg.usd.usg.2000|sgn2}}"] },
          { label: "2010", cells: ["{{usie.effrate.usd.usg.2010|n2}}", "{{usg.value.2010|n2}}", "{{usie.rmg.usd.usg.2010|sgn2}}"] },
          { label: "2019", cells: ["{{usie.effrate.usd.usg.2019|n2}}", "{{usg.value.2019|n2}}", "{{usie.rmg.usd.usg.2019|sgn2}}"] },
          { label: "2024", cells: ["{{usie.effrate.usd.usg.2024|n2}}", "{{usg.value.2024|n2}}", "{{usie.rmg.usd.usg.2024|sgn2}}"] }
        ]
      },
      reading: [
        { label: "Effective rate minus nominal growth, 2024, points", ph: "{{usie.rmg.usd.usg.2024|sgn2}}" },
        { label: "Primary balance, 2024, % of GDP", ph: "{{uspb.value.2024|sgn2}}" },
        { label: "Gross debt, 2024, % of GDP", ph: "{{usd.value.2024|p1}}" }
      ],
      published: [
        { kind: "trend", cited: true, text: "Annual averages computed in the research: the 10-year Treasury yield was 4.21 percent in 2024 against nominal GDP growth of 5.59 percent, and 4.29 percent in 2025 against 5.04 percent. CBO's final review of fiscal 2026 has a deficit of about $2.0 trillion (about 6 percent of GDP).", refs: ["fred_gs10", "aaf_cbo_fy2026"] },
        { kind: "trend", cited: true, text: "Over 1870-2015 across 16 economies the return on wealth averaged about twice the growth rate except around wars, yet the safe rate averaged below growth.", refs: ["jknst2019"] }
      ],
      counterpoint: { kind: "interpretation", text: "Blanchard (2019): safe rates below growth have been the historical norm, so rolling over debt costs little. The gap is volatile and uncertain, and nominal growth includes the inflation that is itself a reason rates are high. The risk is that the effective rate rises toward growth while primary deficits stay as large as the {{uspb.value.2024|sgn2}} points of 2024.", refs: ["blanchard2019"] },
      leaves: { kind: "trend", text: "The gap that matters is the one over the coming years, which no table here measures, and today's gap depends on the basis. On the IMF general-government basis used here it is {{usie.rmg.usd.usg.2024|sgn2}} points for the US in 2024, while the Debt page's federal-budget basis gives a different figure. The primary balance, {{uspb.value.2024|sgn2}} points of GDP in 2024, is the part of the identity that does not depend on the rate.", refs: ["imf_pfmh"] },
      links: [{ label: "Debt: interest rate versus growth", href: "debt.html" }],
      refs: ["imf_pfmh", "fred_gs10", "aaf_cbo_fy2026", "jknst2019", "blanchard2019"]
    },

    // ---------------------------------------------------------------- 4
    {
      id: "strain-4", n: 4, name: "The private credit cycle and leverage",
      why: { kind: "interpretation", text: "Because bank lending creates money, credit booms inflate demand and collateral values, and credit busts destroy money and balance sheets. Fast credit growth is the best-documented predictor of financial crises. Minsky's financial instability hypothesis (1992) makes a related point: long stable periods encourage borrowing that makes the system fragile.", refs: ["minsky1992"] },
      metric: "Credit to households, companies and government as a share of GDP and its change; household debt as a share of GDP; the household debt service ratio.",
      readingTable: {
        title: "United States: credit by sector, % of GDP (BIS, fourth-quarter values)",
        note: "Households and non-financial corporations at market value, government at face value, all lending sectors. The last column adds the three sectors.",
        columns: ["Households", "Corporations", "Households plus corporations", "Government", "All three"],
        rows: [
          { label: "End of 1970", cells: ["{{hhus.value.1970|p1}}", "{{nfcus.value.1970|p1}}", "{{hhus.plus.nfcus.1970|p1}}", "{{ggus.value.1970|p1}}", "{{hhus.plus3.nfcus.ggus.1970|p1}}"] },
          { label: "End of 2000", cells: ["{{hhus.value.2000|p1}}", "{{nfcus.value.2000|p1}}", "{{hhus.plus.nfcus.2000|p1}}", "{{ggus.value.2000|p1}}", "{{hhus.plus3.nfcus.ggus.2000|p1}}"] },
          { label: "End of 2008", cells: ["{{hhus.value.2008|p1}}", "{{nfcus.value.2008|p1}}", "{{hhus.plus.nfcus.2008|p1}}", "{{ggus.value.2008|p1}}", "{{hhus.plus3.nfcus.ggus.2008|p1}}"] },
          { label: "End of 2025", cells: ["{{hhus.value.2025|p1}}", "{{nfcus.value.2025|p1}}", "{{hhus.plus.nfcus.2025|p1}}", "{{ggus.value.2025|p1}}", "{{hhus.plus3.nfcus.ggus.2025|p1}}"] }
        ]
      },
      reading: [
        { label: "Household plus corporate credit, % of GDP, end of 2008", ph: "{{hhus.plus.nfcus.2008|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.plus.nfcus.2025|p1}}" },
        { label: "Household, corporate and government credit together, % of GDP, end of 2008", ph: "{{hhus.plus3.nfcus.ggus.2008|p1}}" },
        { label: "The same, end of 2025", ph: "{{hhus.plus3.nfcus.ggus.2025|p1}}" },
        { label: "Household debt service ratio, % of income, 2007", ph: "{{dsrhhus.value.2007|p1}}" },
        { label: "The same, 2021", ph: "{{dsrhhus.value.2021|p1}}" },
        { label: "The same, 2025", ph: "{{dsrhhus.value.2025|p1}}" }
      ],
      published: [
        { kind: "trend", cited: true, text: "Schularick and Taylor (2012) and Jorda, Schularick and Taylor (2013) find that credit growth predicts crises and deeper recessions across 14 to 17 advanced economies since 1870. Mian, Sufi and Verner (2017) find that rises in household debt relative to GDP are followed by lower growth across 30 countries.", refs: ["schularick_taylor2012", "jst2013", "mian_sufi_verner2017"] },
        { kind: "trend", cited: true, text: "US commercial-bank loans and leases were $14.21 trillion on 14 October 2026, up from $10.90 trillion in March 2022. These are nominal dollars, not scaled by GDP; over the same months consumer prices rose {{cpi.pct.2022-03.latest|p1}}.", refs: ["fred_h8", "bls_cpi"] }
      ],
      counterpoint: { kind: "interpretation", cited: true, text: "Household and corporate leverage in the US has fallen since 2008, although government credit rose by more, so total non-financial credit did not fall (see the table above). Not all booms end badly (Gorton and Ordonez 2020). The calm Bretton Woods years were also a credit-money system, with capital controls and repressed finance, so liberalisation and guarantees may be the cause of the post-1973 rise in crises rather than credit money itself (Bordo and co-authors 2001).", refs: ["gorton_ordonez2020", "bordo2001"] },
      leaves: { kind: "trend", text: "The public sector. Government credit went from {{ggus.value.2008|p1}} of GDP at the end of 2008 to {{ggus.value.2025|p1}} at the end of 2025, and credit to all three sectors from {{hhus.plus3.nfcus.ggus.2008|p1}} to {{hhus.plus3.nfcus.ggus.2025|p1}}. Private deleveraging was offset by public borrowing, which is the shift strain 2 describes.", refs: ["bis_tc"] },
      links: [{ label: "Debt: debt by sector and household debt service", href: "debt.html" }],
      refs: ["bis_tc", "bis_dsr", "minsky1992", "schularick_taylor2012", "jst2013", "mian_sufi_verner2017", "fred_h8", "gorton_ordonez2020", "bordo2001"]
    },

    // ---------------------------------------------------------------- 5
    {
      id: "strain-5", n: 5, name: "Housing affordability and the asset-versus-wage gap",
      why: { kind: "interpretation", text: "When credit meets scarce land, prices adjust rather than quantities. Wage earners without assets fall behind owners, and a rise in rates can freeze the market." },
      metric: "House price relative to household income; hours of work to buy a median home; house prices relative to consumer prices.",
      reading: [
        { label: "Median new house over median household income, 1984", ph: "{{house.per.income.1984|n2}}" },
        { label: "The same, 2022", ph: "{{house.per.income.2022|n2}}" },
        { label: "The same, 2025", ph: "{{house.per.income.2025|n2}}" },
        { label: "Hours of production-worker pay for the median new house, 1964", ph: "{{house.hours.pay.1964|hrs0}}" },
        { label: "The same, 2025", ph: "{{house.hours.pay.2025|hrs0}}" },
        { label: "FHFA house prices after inflation, 1987 to 2024", ph: "{{hpi.realchange.cpi.1987.2024|p1}}" },
        { label: "UK house prices after inflation, 2010 to 2024, against the CPI", ph: "{{ukhouse.realchange.ukcpi.2010.2024|p1}}" },
        { label: "The same against the RPI", ph: "{{ukhouse.realchange.ukrpi.2010.2024|p1}}", note: "The RPI includes housing costs tied to house prices" }
      ],
      published: [
        { kind: "trend", cited: true, text: "England's median house price was 7.6 times median full-time workplace earnings in 2025. UK real house prices (BIS, 2010 = 100) peaked at about 122 in 2022 Q3 and were about 109 in 2026 Q1, close to the CPI-based rise from 2010 shown above and unlike the RPI-based one.", refs: ["ons_afford2025", "bis_spp"] }
      ],
      counterpoint: { kind: "interpretation", text: "Land-use rules and supply restriction explain most of the gap between prices and building costs (Glaeser and Gyourko 2018; Knoll, Schularick and Steger 2017). Rising house values are wealth for most households, who own their homes. The median new-house series is not adjusted for quality, and the new house is bigger.", refs: ["glaeser_gyourko2018", "knoll2017"] },
      leaves: { kind: "interpretation", text: "The people who do not own. Owners gain from rising values, while renters and first-time buyers face higher prices or rents, so the same rise is a gain for some households and a cost for others. This page holds no figure for how the two groups compare.", refs: [] },
      links: [{ label: "Prices and Purchasing Power: houses and land", href: "prices.html" }],
      refs: ["census_nrs", "census_cps", "bls_ces", "fhfa_hpi", "ons_afford2025", "bis_spp", "glaeser_gyourko2018", "knoll2017"]
    },

    // ---------------------------------------------------------------- 6
    {
      id: "strain-6", n: 6, name: "Real returns on safe savings",
      why: { kind: "interpretation", text: "If safe returns sit below inflation for years, holders of cash and low-rate deposits transfer wealth to debtors and the state, and those with fewer alternatives bear most of it." },
      metric: "The real return on bills and bank rates (the nominal rate minus year-on-year inflation); the real 10-year TIPS yield; the cumulative real value of money held in each.",
      readingTable: {
        title: "Mean real return on 3-month Treasury bills (annual-average rate against annual-average CPI-U)",
        note: "Ex post, before tax, on the published discount rate (which understates the yield; see claim 5). A negative number means purchasing power fell.",
        columns: ["Mean real return a year"],
        rows: [
          { label: "1946 to 1980", cells: ["{{tbill.realavg.cpi.1946.1980|p2}}"] },
          { label: "1974 to 1980", cells: ["{{tbill.realavg.cpi.1974.1980|p2}}"] },
          { label: "1981 to 1999", cells: ["{{tbill.realavg.cpi.1981.1999|p2}}"] },
          { label: "2000 to 2008", cells: ["{{tbill.realavg.cpi.2000.2008|p2}}"] },
          { label: "2009 to 2021", cells: ["{{tbill.realavg.cpi.2009.2021|p2}}"] },
          { label: "2022 to 2024", cells: ["{{tbill.realavg.cpi.2022.2024|p2}}"] }
        ]
      },
      reading: [
        { label: "Real return on 3-month bills over the latest 12 months", ph: "{{tbill.realreturn.cpi.latest|p2}}" },
        { label: "Mean real return, 1934 to 2025", ph: "{{tbill.realavg.cpi.1934.2025p|p2}}" },
        { label: "Years with a negative real return, 1934 to 2025", ph: "{{tbill.realneg.cpi.1934.2025p|n0}}" },
        { label: "Years in that count", ph: "{{tbill.realyears.cpi.1934.2025p|n0}}" },
        { label: "Average gap between the bill's investment yield and its discount rate, 1934 to 2025, points", ph: "{{tbill.yieldgap.1934.2025|n2}}", note: "Not included in the real returns above" }
      ],
      published: [
        { kind: "trend", cited: true, text: "The FDIC national average savings rate was 0.38 percent and the money-market deposit account rate 0.63 percent on 19 October 2026, against consumer price inflation of 3.74 percent. The 10-year Treasury yield was 4.99 percent in September 2026 and the 10-year TIPS yield 2.64 percent on 22 October 2026; the TIPS yield was -1.19 percent on 3 August 2021.", refs: ["fdic_rates", "fred_gs10", "fred_dfii10"] },
        { kind: "interpretation", text: "A rough estimate of the inflation tax on cash, the research team's own and not a published figure: cash held by the public of about $2.4 trillion (FRED CURRSL) loses about $72 billion of purchasing power a year at 3 percent inflation. It includes cash held abroad.", refs: ["fred_currsl"] }
      ],
      counterpoint: { kind: "interpretation", text: "Money-market funds, Treasury bills and online savings accounts pay near market rates, and the 10-year real yield is positive now, so repression is not the current regime. How much this matters depends on how many households hold such instruments rather than low-rate deposits, and this page has no figure for that share. The postwar repression era had few banking crises, and creditors partly price in later inflation. Pensioners and households also hold government debt, so part of the transfer is from savers to themselves as taxpayers.", refs: ["reinhart_sbrancia2015", "bordo2001"] },
      leaves: { kind: "trend", cited: true, text: "How many households hold only low-rate deposits. The FDIC national average savings rate is 0.38 percent against 3.74 percent inflation, a real return of about -3.4 percent, and interest is taxed, so after-tax returns on bills are lower than those shown here (the safe-savings tile on this page works one illustration).", refs: ["fdic_rates"] },
      links: [{ label: "Prices and Purchasing Power: real return on savings", href: "prices.html" }],
      refs: ["fed_h15", "bls_cpi", "fdic_rates", "fred_gs10", "fred_dfii10", "reinhart_sbrancia2015", "bordo2001"]
    },

    // ---------------------------------------------------------------- 7
    {
      id: "strain-7", n: 7, name: "Price-level drift and inflation credibility",
      why: { kind: "interpretation", text: "An inflation target fixes the rate, not the level: every overshoot is kept, so prices compound. Critics argue that credibility failed in 1965-82 and in 2021-23; others argue that long-run expectations stayed anchored in 2021-23. This page holds no expectations series, so it cannot settle that." },
      metric: "The CPI level and the purchasing power of a dollar; years to double over any window; year-on-year inflation against the target; inflation expectations (not loaded on this site).",
      readingNote: "This site holds no inflation-expectations series, so there is no computed expectations reading and the page cannot show whether expectations stayed anchored in 2021-23.",
      reading: [
        { label: "Consumer prices, year on year, latest month", ph: "{{cpi.yoy.latest|p1}}" },
        { label: "Consumer prices, year on year, June 2022", ph: "{{cpi.yoy.2022-06|p2}}" },
        { label: "Consumer prices since February 2020", ph: "{{cpi.pct.2020-02.latest|p1}}" },
        { label: "Years to double at two percent a year", ph: "{{calc.doubling_from_rate.2|yrs1}}" },
        { label: "Years to double since August 1971", ph: "{{cpi.doubling.1971-08.latest|yrs1}}" },
        { label: "Years to double since September 1991", ph: "{{cpi.doubling.1991-09.latest|yrs1}}" }
      ],
      published: [],
      counterpoint: { kind: "interpretation", cited: true, text: "The alternative with a hard price-level anchor, the classical gold standard, had stable long-run prices but output volatility roughly equal to Bretton Woods and above the post-1970 float, and it collapsed in the 1930s. That answers only the gold version. Ball and Sheridan find no clear effect of inflation targeting itself, and Stock and Watson attribute 40 to 60 percent of the Great Moderation to unidentified smaller shocks, but Roger (IMF 2009) finds that targeters compare favourably, so the regime's credit is contested.", refs: ["basu_taylor1999", "ball_sheridan2003", "stock_watson2002", "roger2009"] },
      leaves: { kind: "interpretation", text: "The intermediate designs. Price-level targeting and make-up strategies keep the rate target but correct overshoots, which is the point of the concern. The Federal Reserve adopted a flexible average-inflation framework in August 2020, and this page has no evidence on how it performed. Neither the gold standard's record nor the inflation-targeting record speaks to these designs.", refs: ["fed_longer_run_goals"] },
      links: [{ label: "Prices and Purchasing Power: doubling-time calculator", href: "prices.html" }],
      refs: ["bls_cpi", "fed_inflation_goal", "basu_taylor1999", "ball_sheridan2003", "stock_watson2002", "roger2009", "fed_longer_run_goals"]
    },

    // ---------------------------------------------------------------- 8
    {
      id: "strain-8", n: 8, name: "Large monetary and fiscal expansions, and how far they have been reversed",
      why: { kind: "interpretation", text: "Central banks can expand their balance sheets and governments can run large deficits, and there is no fixed rule on when to do so. Large expansions in emergencies can overshoot and then need a painful reversal." },
      metric: "Federal Reserve assets relative to GDP; M2 growth; loans relative to deposits; consumer price inflation; the federal deficit.",
      reading: [
        { label: "Federal Reserve total assets, end of 2007", ph: "{{fed.value.2007|usdbn}}" },
        { label: "Federal Reserve total assets, end of 2022", ph: "{{fed.value.2022|usdbn}}" },
        { label: "Federal Reserve total assets, end of 2025", ph: "{{fed.value.2025|usdbn}}" },
        { label: "Change in Federal Reserve assets, end of 2022 to end of 2025", ph: "{{fed.pct.2022.2025|p1}}" },
        { label: "Federal Reserve assets, % of GDP, 2000", ph: "{{fed.share.gdp.2000|p1}}" },
        { label: "The same, 2025", ph: "{{fed.share.gdp.2025|p1}}" },
        { label: "M2 change, end of 2015 to end of 2022", ph: "{{m2.pct.2015.2022|p1}}" },
        { label: "M2 change, end of 2022 to end of 2025", ph: "{{m2.pct.2022.2025|p1}}" },
        { label: "Federal deficit, fiscal 2019, $ billion", ph: "{{usout.minus.usrcpt.2019|n0}}" },
        { label: "Federal deficit, fiscal 2020, $ billion", ph: "{{usout.minus.usrcpt.2020|n0}}" },
        { label: "Federal deficit, fiscal 2021, $ billion", ph: "{{usout.minus.usrcpt.2021|n0}}" },
        { label: "Federal deficit, fiscal 2026, $ billion", ph: "{{usout.minus.usrcpt.2026|n0}}" }
      ],
      published: [
        { kind: "trend", cited: true, text: "US M2 rose 40.6 percent from February 2020 to March 2022 and fell 4.8 percent from March 2022 to October 2023; M2 grew 5.66 percent in the year to August 2026. Loans were 72 percent of deposits in October 2026.", refs: ["fred_m2sl", "fred_h8"] }
      ],
      counterpoint: { kind: "interpretation", text: "The expansion was partly reversed on the central-bank balance sheet: the Federal Reserve's assets changed by {{fed.pct.2022.2025|p1}} between the end of 2022 and the end of 2025, and M2 contracted for a time without a deflationary spiral. Inflation in 2021-22 also had supply causes (Bernanke and Blanchard 2023). The emergency expansion may have prevented debt deflation, which is a counterfactual that cannot be tested.", refs: ["bernanke_blanchard2023"] },
      leaves: { kind: "trend", text: "How partial the reversal was. Federal Reserve assets in 2025 were {{fed.ratio.2007.2025|x1}} their end-2007 level and {{fed.share.gdp.2025|p1}} of GDP against {{fed.share.gdp.2000|p1}} in 2000; M2 in 2025 was {{m2.pct.2022.2025|p1}} above its 2022 level; and the federal deficit was {{usout.minus.usrcpt.2026|n0}} billion dollars in fiscal 2026 against {{usout.minus.usrcpt.2019|n0}} billion in fiscal 2019. The monetary side has partly reversed and the fiscal side has not.", refs: ["money_history", "omb_hist", "treasury_mts"] },
      links: [{ label: "Money Over Time: the Federal Reserve balance sheet", href: "monetary-history.html#v=history&sh=fedBalance" }],
      refs: ["money_history", "omb_hist", "bls_cpi", "fred_m2sl", "fred_h8", "bernanke_blanchard2023"]
    },

    // ---------------------------------------------------------------- 9
    {
      id: "strain-9", n: 9, name: "The implicit public backstop (moral hazard)",
      why: { kind: "interpretation", text: "Deposits are bank IOUs used as money, so governments insure deposits and rescue large banks. The expectation of rescue lowers funding costs and encourages leverage, while tail losses fall on taxpayers." },
      metric: "The funding-cost gap between systemically important banks and others; insured deposits relative to GDP; the fiscal cost and output loss of banking crises.",
      readingNote: "This site holds no data series for this strain, so there is no computed reading. The published estimates below are the best available and differ widely.",
      reading: [],
      published: [
        { kind: "trend", cited: true, text: "Estimates of the implicit subsidy to major UK banks range from about GBP 6 billion to more than GBP 100 billion (Noss and Sowerbutts 2012). Laeven and Valencia (2018) record 151 systemic banking crises in 1970-2017, with a median net fiscal cost of 3.3 percent of GDP in high-income countries.", refs: ["noss_sowerbutts2012", "laeven_valencia2018"] }
      ],
      counterpoint: { kind: "interpretation", cited: true, text: "The estimates differ by a factor of more than 15, so the size is uncertain. Reforms after 2008 (higher capital, resolution regimes, bail-in) were meant to shrink the subsidy. Deposit insurance protects against runs, which before 1933 repeatedly destroyed the money stock: about 9,000 bank suspensions in 1930-33, and the FDIC says no insured depositor has lost money since 1934.", refs: ["noss_sowerbutts2012", "fdic_90years"] },
      leaves: { kind: "interpretation", text: "How far the backstop reaches in a crisis. Deposit insurance covers deposits up to a limit, while rescues of large banks in crises have gone further, which is the moral-hazard worry itself. This page holds no series that measures how often.", refs: [] },
      links: [],
      refs: ["noss_sowerbutts2012", "laeven_valencia2018", "fdic_90years"]
    },

    // ---------------------------------------------------------------- 10
    {
      id: "strain-10", n: 10, name: "Concentration of wealth, and the first recipients of new money",
      why: { kind: "interpretation", text: "New money and asset-price booms reach owners first. If asset prices outrun wages, a gap opens between those who own collateral and those who do not." },
      metric: "Household net worth relative to GDP; the top 1 percent and bottom 50 percent shares of net worth; real wage growth against asset-price growth.",
      reading: [
        { label: "Pay for production workers after inflation, 1987 to 2024", ph: "{{pay.realchange.cpi.1987.2024|p1}}" },
        { label: "Median household income after inflation, 1987 to 2024", ph: "{{income.realchange.cpi.1987.2024|p1}}" },
        { label: "FHFA house prices after inflation, 1987 to 2024", ph: "{{hpi.realchange.cpi.1987.2024|p1}}" },
        { label: "Pay after inflation, 2000 to 2024", ph: "{{pay.realchange.cpi.2000.2024|p1}}" },
        { label: "Median household income after inflation, 2000 to 2024", ph: "{{income.realchange.cpi.2000.2024|p1}}" },
        { label: "FHFA house prices after inflation, 2000 to 2024", ph: "{{hpi.realchange.cpi.2000.2024|p1}}" },
        { label: "Pay after inflation, 2014 to 2024", ph: "{{pay.realchange.cpi.2014.2024|p1}}" },
        { label: "Median household income after inflation, 2014 to 2024", ph: "{{income.realchange.cpi.2014.2024|p1}}" },
        { label: "FHFA house prices after inflation, 2014 to 2024", ph: "{{hpi.realchange.cpi.2014.2024|p1}}" },
        { label: "Pay after inflation, 1973 to 2024 (a different start: 1973 is the peak of real production-worker pay)", ph: "{{pay.realchange.cpi.1973.2024|p1}}" },
        { label: "Median household income after inflation, 1984 to 2024 (a different start)", ph: "{{income.realchange.cpi.1984.2024|p1}}" }
      ],
      readingNote: "Each trio of lines uses one start year for pay, income and house prices. The last two lines start earlier and are labelled separately.",
      published: [
        { kind: "trend", cited: true, text: "The top 1 percent's share of US net worth rose from 22.8 percent (1989 Q3) to 32.5 percent (2026 Q2) and the bottom 50 percent's share fell from 3.5 to 2.3 percent. Household net worth was 6.02 times GDP in 2026 Q2, against 3.33 times in 1980 Q1 and 4.43 times in 2000 Q1.", refs: ["fed_dfa", "fred_tnwbshno"] }
      ],
      counterpoint: { kind: "interpretation", cited: true, text: "Causation is not established: falling rates, demographics, zoning and a global saving glut also lift asset prices. Some studies find that easing lowered income inequality by cutting unemployment (Lenza and Slacalek 2018) and that contractionary shocks raised it (Coibion and co-authors 2017). The Bank of England, assessing its own asset purchases in 2012, concluded that most households would have been worse off without them.", refs: ["lenza_slacalek2018", "coibion2017", "boe2012_qe"] },
      leaves: { kind: "trend", cited: true, text: "Who gained most even if most households gained. The Bank of England's own 2012 paper found that the top 5 percent of UK households held about 40 percent of household financial assets, and in the US the top 1 percent hold 32.5 percent of net worth against 2.3 percent for the bottom half. The three papers cited in the counterpoint were named in the research and not re-read for this page.", refs: ["boe2012_qe", "fed_dfa"] },
      links: [{ label: "Prices and Purchasing Power: pay against house prices", href: "prices.html" }],
      refs: ["bls_ces", "census_cps", "fhfa_hpi", "bls_cpi", "fed_dfa", "fred_tnwbshno", "lenza_slacalek2018", "coibion2017", "boe2012_qe"]
    }
  ],

  // Money systems compared. No ranking and no winner. outcomes[].basis is "computed" (placeholders over the data files)
  // or "cited" (a published figure). cases, strengths and weaknesses summarise the cited sources.
  systems: {
    title: "Other ways to run money",
    intro: "Nine ways of creating and limiting money, each described the same way: how money is created, historical cases, measured outcomes with their periods, strengths and weaknesses. None of them is costless and none is declared the best. Regimes were not randomly assigned: periods, countries, shocks and data quality differ, so the outcomes are not strictly comparable.",
    evidenceNote: "Evidence quality differs and is flagged on each card: historical measurement for the gold standards, Bretton Woods and floating fiat; episode evidence for currency boards and printing; models and one referendum for sovereign money; opinion and a few episodes for money-financed deficits; a short record for fixed-supply digital money.",
    readings: [
      { kind: "trend", cited: true, text: "Average inflation, by period: the US averaged 0.1 percent a year under the classical gold standard (1880-1914), and the G7 averaged 3.67 percent in 1961-70 (Bretton Woods), 7.65 percent in 1971-89 (floating, no explicit anchor), 1.84 percent in 1993-2007 (inflation targets) and 3.34 percent in 2020-24. The printing episodes are off this scale. Each figure is for its own sample and period.", refs: ["bordo_econlib", "wdi_cpi_growth"] },
      { kind: "trend", cited: true, text: "Output volatility, by regime: the standard deviation of log real output was 0.027 under the classical gold standard, 0.036 interwar, 0.025 under Bretton Woods and 0.016 under the post-1970 float, in a 15-country sample whose pre-1913 data are weaker.", refs: ["basu_taylor1999"] },
      { kind: "trend", cited: true, text: "Crises, by regime: crisis frequency since 1973 is about twice that of the classical gold standard or Bretton Woods in the sources cited, but crisis definitions and samples differ (all crisis types for the earlier samples, banking crises only for 1973-2006).", refs: ["bordo_eichengreen1999", "bordo2001"] },
      { kind: "interpretation", text: "Two of the calm periods relied on conditions that no longer hold or are contested: capital controls, financial repression and post-war catch-up growth in the case of Bretton Woods, and a share of luck in the case of 1993-2007. The scoreboard sets the measures side by side so that no single measure decides.", refs: ["bordo_eichengreen1999", "stock_watson2002"] },
      { kind: "interpretation", text: "The classical gold standard had a mean-reverting price level, but more output volatility than the post-1970 float in the sample studied, and it was suspended in every major war.", refs: ["bordo_econlib", "basu_taylor1999"] },
      { kind: "interpretation", text: "The link between money growth and inflation is close when money growth is large and persistent, and loose in the low-inflation targeting era, so watching growth rates tells more than watching M2 levels. That is an inference from descriptive correlations, not a published result.", refs: ["mccandless_weber1995", "mankiw2020"] }
    ],
    caveats: [
      "Regimes are not randomly assigned. Samples, countries, shocks and data quality differ. Pre-1913 national accounts are weaker and probably exaggerate recession severity. Bretton Woods growth includes post-war catch-up, and its calm banking sector depended on capital controls and financial repression.",
      "Volatility measures are not interchangeable: the standard deviation of annual inflation, the coefficient of variation (misleading when the mean is near zero), the standard deviation of filtered log levels, and the annualised standard deviation of daily returns (for bitcoin).",
      "Crisis counts use different definitions and samples: all crisis types for pre-1914 emerging markets and the interwar sample, banking crises only for 1973-2006. They should not be compared directly.",
      "The full-reserve results are model simulations from one US calibration, not outcomes. Hyperinflation data are unreliable by nature, because official statistics stopped in Zimbabwe and Venezuela and some peaks come from secondary reproductions.",
      "Several sources could not be opened as text during research (scanned tables, blocked pages). Claims resting on abstracts, search summaries or secondary reproductions are flagged in the Sources list."
    ],
    scoreboard: {
      title: "Measured outcomes side by side (published figures, with a few computed here)",
      note: "G7 means the US, UK, Germany, France, Italy, Japan and Canada, from World Bank data. 'SD' is a standard deviation. A figure computed from the data files on this site shows its period and source when you hover over it. The World Bank series starts in 1960, so the Bretton Woods G7 row uses 1961-70, the first full decade, and the fiat rows are split by period rather than by decade. Cells are not strictly comparable; see the caveats.",
      columns: ["Sample and period", "Average inflation", "Output volatility", "Crisis frequency", "Growth"],
      rows: [
        { system: "sys-gold", cells: ["US 1880-1914; 15 countries 1870-1914", "US 0.1 percent a year", "15-country SD of log output 0.027", "Emerging markets 1880-1914: 22 crises in 510 country-years (4.3 percent); US panics in 1873, 1884, 1890, 1893 and 1907", "1.3 percent a year real GDP per head (industrial countries, 1870-1913)"] },
        { system: "sys-interwar", cells: ["21-country crisis sample and 15-country output sample, 1919-1939", "US 1921-33 {{cpi.cagr.1921.1933|p2}} a year (annual averages); US prices {{cpi.pct.1929.1933|p1}} 1929-33", "SD of log output 0.036", "About 10 percent of country-years", "1.2 percent a year per head (1914-1950)"] },
        { system: "sys-bretton", cells: ["G7 1961-70; 15 countries 1945-71", "G7 3.67 percent a year (SD 1.38)", "G7 growth SD 2.01; SD of log output 0.025", "No banking crises in the sample; mild currency crises", "G7 real GDP 5.39 percent a year (1961-70)"] },
        { system: "sys-fiat", cells: ["G7 1971-89 (no explicit anchor)", "7.65 percent a year (SD 4.15)", "Growth SD 2.11", "Crisis frequency since 1973 about double that of the gold standard or Bretton Woods", "3.22 percent a year"] },
        { system: "sys-fiat", cells: ["G7 1990-2007 (1993-2007)", "2.26 percent (1.84 percent); SD 1.27 (0.72)", "Growth SD 1.44 (1.18)", "1973-2006 banking crises per country-year: advanced 0.67 percent, emerging 2.94 percent", "2.19 percent (2.28 percent)"] },
        { system: "sys-fiat", cells: ["G7 2008-2019 and 2020-2024", "1.41 percent (SD 0.95) and 3.34 percent (SD 2.52)", "Growth SD 1.96 and 4.56", "The 2007-09 global crisis; not estimated for 2020-24", "1.02 percent and 1.13 percent"] },
        { system: "sys-board", cells: ["Hong Kong 1984-2024; Bulgaria 1998-2025", "Hong Kong 3.58 percent; Bulgaria 5.07 percent", "Growth SD: Hong Kong 4.14; Bulgaria 3.57", "Episodes: Hong Kong 1998, Argentina 2001-02, the Baltics 2009", "Hong Kong 3.79 percent; Bulgaria 2.92 percent"] },
        { system: "sys-sovereign", cells: ["None implemented; one US model; one referendum (a popularity result, not an economic outcome)", "Model: steady-state inflation can fall to zero", "Model: lower credit-cycle volatility", "Model: bank runs impossible; no measured frequency", "Model: long-run output gain approaches 10 percent"] },
        { system: "sys-printing", cells: ["Continentals 1775-81; Greenbacks 1862-79; Confederacy; Weimar 1921-23; Zimbabwe 2007-09; Venezuela 2017-20", "Greenbacks about 15.8 percent a year; Weimar peak about 29,500 percent a month; Zimbabwe peak an estimated 79.6 billion percent a month", "Not meaningful in hyperinflation; real GDP about -50 percent in Zimbabwe 2000-08 and about -75 percent in Venezuela 2014-20", "Not applicable", "Not meaningful"] },
        { system: "sys-mmt", cells: ["No explicit adopter; US 2020-22 and Japan as partial analogues", "US peak 9.0 percent (June 2022) after M2 rose 40.5 percent (February 2020 to April 2022)", "Not estimated", "Not estimated", "Not estimated"] },
        { system: "sys-digital", cells: ["Bitcoin 2011-2026; El Salvador 2021-2026", "Issuance about 0.82 percent a year", "Not applicable; annualised price volatility 42 to 150 percent by year", "Drawdowns of 53 to 85 percent five times since 2013", "Not applicable"] }
      ]
    },

    items: [
      // ------------------------------------------------------------ gold
      {
        id: "sys-gold", name: "Commodity money and the classical gold standard", period: "c. 1870s to August 1914",
        status: "Operated historically",
        evidence: "Historical measurement. National statistics before 1913 are weaker and probably exaggerate recession severity. This card describes the historical gold standard, run with central banks and fractional reserves. Sound-money critics usually propose a different design, 100 percent gold reserves or free banking with competing note issuers (Selgin and White 1994); that design has not operated at national scale and is not scored here.",
        created: "Pure commodity money is coin whose face value is its metal content, so supply grows with mining, imports and rulers' debasement rather than with output. Under the classical gold standard each currency was defined as a fixed weight of gold (US $20.67 an ounce from 1834 to 1933), mints coined gold on demand, and banks issued convertible notes and deposits against fractional gold reserves. Most money in core countries was therefore still bank-created credit. Convertibility and gold flows were the long-run limit on creation, and the rule was suspended in wars.",
        matrix: {
          creates: "Miners and mints; banks lend against fractional gold reserves.",
          limit: "Convertibility into gold at a fixed price, and gold flows between countries.",
          firstRecipient: "Miners, gold importers and, through lending, bank borrowers.",
          scale: "Operated at national scale until 1914",
          strongestFor: "The best long-run price anchor in the record.",
          strongestAgainst: "Money follows mining rather than output, and the commitment gave way in every major war."
        },
        cases: [
          "Britain returned to gold in 1821 and the US resumed specie payments on 1 January 1879. Adherence was broad from the 1870s until August 1914, when it was suspended.",
          "US panics under the standard: 1873, 1884, 1890, 1893 and 1907."
        ],
        outcomes: [
          { label: "UK retail prices, annual rate", value: "{{ukrpia.cagr.1870.1913|p2}} a year", period: "1870 to 1913", scope: "United Kingdom", basis: "computed", refs: ["ons_rpi"] },
          { label: "US inflation", value: "0.1 percent a year, against 4.1 percent a year in 1946-2003", period: "1880-1914", scope: "United States", basis: "cited", refs: ["bordo_econlib"] },
          { label: "Price level", value: "Mean-reverting under convertible regimes and drifting under fiat; pooled price-level volatility 0.033 in 1870-1914 against 0.046 under Bretton Woods", period: "1870-1914", scope: "15 countries", basis: "cited", refs: ["bordo_nber1999", "basu_taylor1999"] },
          { label: "Output volatility", value: "Standard deviation of log real output 0.027, against 0.036 interwar, 0.025 under Bretton Woods and 0.016 under the post-1970 float", period: "1870-1914", scope: "15 countries", basis: "cited", refs: ["basu_taylor1999"] },
          { label: "Crises", value: "22 crises in 510 country-years (4.3 percent) in emerging markets; crisis frequency since 1973 is about double", period: "1880-1914", scope: "15 emerging markets", basis: "cited", refs: ["bordo_eichengreen1999", "bordo2001"] },
          { label: "Growth", value: "1.3 percent a year real GDP per head", period: "1870-1913", scope: "Industrial countries", basis: "cited", refs: ["maddison_rba"] }
        ],
        strengths: [
          "The best long-run price anchor in the record: near-zero average inflation and a mean-reverting price level.",
          "Fixed exchange rates and an open capital market; a credible commitment to resume at the old parity after a wartime suspension kept crises at the core short.",
          "Governments could not inflate the money supply at will.",
          "The late-19th-century deflation in the US, UK and Germany was driven by supply (productivity) and money-supply shocks and had little output cost (Bordo, Landon-Lane and Redish 2004)."
        ],
        weaknesses: [
          "The money supply followed mining and gold flows, not output or demand for money, which produced long deflation in the 1870s-1890s and short-run price swings.",
          "Output was about as volatile as under Bretton Woods and more volatile than under the post-1970 float in the 15-country sample (a data-quality caveat applies). US unemployment averaged 6.8 percent in 1879-1913 against 5.9 percent in 1946-2003.",
          "Fractional-reserve deposit banking still produced panics, especially where there was no lender of last resort. Some economists trace the US panics of 1873-1907 to US banking rules (limits on branching and on note issue) rather than to the gold standard, and point to Canada, which had no comparable panics on the same standard (Calomiris and Haber 2014). That is one side of a dispute.",
          "Convertibility was suspended in every major war, and the commitment rested on political conditions (a narrow franchise, weak unions) that no longer hold.",
          "Pure commodity money has its own inflation tax, because rulers debased the coin (for example the Roman denarius and Tudor sterling).",
          "Friedman estimated that a full gold-coin standard would cost the US more than 2.5 percent of GNP in resources in 1960."
        ],
        refs: ["bordo_econlib", "bordo_nber1999", "basu_taylor1999", "bordo_eichengreen1999", "bordo2001", "maddison_rba", "bordo_lane_redish2004", "ons_rpi", "calomiris_haber2014", "selgin_white1994"]
      },

      // ------------------------------------------------------------ interwar
      {
        id: "sys-interwar", name: "Interwar gold exchange standard", period: "1919 to 1939 (restored in the mid-1920s, collapsed 1931-1936)",
        status: "Operated historically",
        evidence: "Historical measurement, with the German hyperinflation dominating the pooled price figures.",
        created: "After the First World War countries re-pegged to gold, but central banks increasingly held reserves as foreign exchange (sterling, dollars) rather than metal, so one unit of gold supported several units of reserve currency. Notes and deposits were issued against gold or foreign-exchange cover ratios, and commercial banks still created deposits by lending. The Federal Reserve and the Bank of France sterilised gold inflows, so the 'rules of the game' were not followed.",
        matrix: {
          creates: "Central banks against gold and foreign-exchange reserves; commercial banks by lending.",
          limit: "Gold and foreign-exchange cover ratios, in principle; in practice sterilisation by the largest holders.",
          firstRecipient: "Borrowers and, in crises, the banks that were rescued or allowed to fail.",
          scale: "Operated at national scale",
          strongestFor: "It economised on scarce monetary gold and tried to restore the pre-war order.",
          strongestAgainst: "The strongest historical evidence that a hard anchor can be harmful in a crisis."
        },
        cases: [
          "Britain resumed gold in 1925 and left it in September 1931. The US restricted gold in 1933, and the Gold Reserve Act of 30 January 1934 reset the price from $20.67 to $35 an ounce, a devaluation of about 41 percent.",
          "Banking panics in 1930-33 in the US and Europe spread through the fixed exchange rates as twin banking and currency crises.",
          "Germany's hyperinflation of 1923 sits just before the restoration and dominates the pooled price statistics."
        ],
        outcomes: [
          { label: "US consumer prices, 1929 to 1933", value: "{{cpi.pct.1929.1933|p1}}", period: "1929 to 1933", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "US consumer prices, annual rate", value: "{{cpi.cagr.1921.1933|p2}} a year", period: "1921 to 1933", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "UK retail prices", value: "{{ukrpia.pct.1920.1933|p1}}, of which {{ukrpia.pct.1920.1925|p1}} came by 1925, before the return to gold; prices in 1933 were still {{ukrpia.pct.1913.1933|p1}} above 1913", period: "1920 to 1933", scope: "United Kingdom", basis: "computed", refs: ["ons_rpi"] },
          { label: "Output volatility", value: "Standard deviation of log real output 0.036, about one half higher than under the classical gold standard", period: "1919-1939", scope: "15 countries", basis: "cited", refs: ["basu_taylor1999"] },
          { label: "Money stock", value: "The US money stock fell nearly 30 percent between fall 1930 and winter 1933", period: "1930-33", scope: "United States", basis: "cited", refs: ["fedhist_great_depression"] },
          { label: "Crises", value: "About 10 percent of country-years had a crisis, against 4.3 percent for pre-1914 emerging markets; the difference was the severity of 1930s banking and twin crises", period: "1919-1939", scope: "21 countries", basis: "cited", refs: ["bordo_eichengreen1999"] },
          { label: "Leaving gold", value: "Countries that left gold earlier (UK 1931, US 1933-34) recovered earlier; in 24 countries, those that stayed on gold longer had deeper depressions", period: "1929-1936", scope: "24 countries", basis: "cited", refs: ["bernanke_james1991", "eichengreen_sachs1985"] }
        ],
        strengths: [
          "It economised on scarce monetary gold by letting reserves be held in foreign exchange.",
          "It attempted to restore the pre-war price and exchange-rate order and international lending.",
          "The exit option mattered: countries that left gold early recovered faster."
        ],
        weaknesses: [
          "A fragile structure: foreign-exchange reserves were large relative to gold, the official gold price was fixed, and the Federal Reserve and the Bank of France sterilised inflows.",
          "The commitment to gold was less credible than before 1914, so capital flows destabilised rather than stabilised.",
          "It transmitted the US banking panic and deflation worldwide, and the monetary contraction of 1929-33 was the largest in the record.",
          "It has the worst combined record in the sample on output volatility and crisis incidence."
        ],
        refs: ["basu_taylor1999", "bordo_eichengreen1999", "bernanke_james1991", "eichengreen_sachs1985", "fedhist_great_depression", "fedhist_gold_reserve", "bordo_nber1999", "bls_cpi", "ons_rpi"]
      },

      // ------------------------------------------------------------ Bretton Woods
      {
        id: "sys-bretton", name: "Bretton Woods", period: "1944 agreement; convertible 1958 to 1971",
        status: "Operated historically",
        evidence: "Historical measurement. Its calm banking sector depended on capital controls and financial repression.",
        created: "Each currency was pegged to the US dollar with adjustable pegs, and the dollar was convertible into gold at $35 an ounce for foreign governments and central banks. The IMF lent reserves and capital controls were allowed. Domestically, central banks and commercial banks created money as they do today, by lending, but within heavy financial regulation: interest-rate ceilings, capital controls, deposit insurance and lenders of last resort created after the 1930s.",
        matrix: {
          creates: "Central banks and commercial banks, inside regulated, controlled financial systems.",
          limit: "The dollar peg to gold and the other currencies' pegs to the dollar, plus capital controls and interest-rate ceilings.",
          firstRecipient: "Borrowers in regulated credit markets.",
          scale: "Operated at national scale",
          strongestFor: "The best measured combined record of growth, inflation and banking stability among the regimes.",
          strongestAgainst: "It rested on special post-war conditions and unwound under the Triffin dilemma."
        },
        cases: [
          "July 1944: 44 countries met at Bretton Woods, New Hampshire. The system became operational in 1958.",
          "1961: the London Gold Pool was formed by eight central banks and collapsed in March 1968. The Federal Reserve opened swap lines in March 1962.",
          "The Triffin dilemma: persistent US deficits were needed to supply dollar reserves, and they eroded confidence in the dollar.",
          "15 August 1971: President Nixon closed the gold window, imposed a 90-day wage and price freeze and a 10 percent import surcharge. The Smithsonian agreement tried to restore the pegs, but the system soon ended."
        ],
        outcomes: [
          { label: "US consumer prices, annual rate", value: "{{cpi.cagr.1959.1971|p2}} a year", period: "1959 to 1971", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "Inflation and growth", value: "G7 inflation averaged 3.67 percent a year (SD 1.38) and real GDP growth 5.39 percent a year (SD 2.01)", period: "1961-70", scope: "G7", basis: "cited", refs: ["wdi_cpi_growth"] },
          { label: "Volatility", value: "Standard deviation of log real output 0.025 and of the log price level 0.046; the most stable regime for most G7 countries in 1959-71", period: "1945-71", scope: "15 countries", basis: "cited", refs: ["basu_taylor1999", "bordo_nber1999"] },
          { label: "Crises", value: "No banking crises in the Bordo-Eichengreen sample and mild currency crises", period: "1945-71", scope: "Sample of countries", basis: "cited", refs: ["bordo_eichengreen1999"] },
          { label: "Late-1960s drift", value: "US inflation rose from 1.6 percent in 1965 to 5.8 percent in 1970", period: "1965-70", scope: "United States", basis: "cited", refs: ["fedhist_great_inflation"] }
        ],
        strengths: [
          "The best combined record in the sample: fast growth, moderate inflation, the lowest output volatility among the pre-float regimes, and no banking crises.",
          "Central banks had room to pursue domestic employment goals behind capital controls while keeping exchange rates stable.",
          "It rebuilt trade and, gradually, capital flows after 1945."
        ],
        weaknesses: [
          "Its stability partly reflected special conditions: post-war reconstruction and catch-up growth, US dominance, and financial repression that held down savers' returns (an inference from the sources).",
          "The Triffin dilemma and asymmetric adjustment: deficit countries had to adjust but the US did not, and foreign-held dollars eventually exceeded US gold.",
          "It eroded from the mid-1960s. The Federal Reserve's account links its collapse to the Great Inflation of 1965-82, with US inflation close to 15 percent in March 1980."
        ],
        refs: ["bls_cpi", "wdi_cpi_growth", "basu_taylor1999", "bordo_nber1999", "bordo_eichengreen1999", "fedhist_great_inflation", "fedhist_gold_ends"]
      },

      // ------------------------------------------------------------ fiat
      {
        id: "sys-fiat", name: "Floating fiat money with inflation targeting", period: "floating from 1971-73; targeting from 1990",
        status: "Operating today",
        evidence: "Historical measurement. Whether targeting itself helped is contested.",
        created: "There is no convertibility. Base money (cash and bank reserves) is a central-bank liability, while the broad money stock is mostly created by commercial banks when they lend and destroyed when loans are repaid. The central bank steers the short-term interest rate, and since 2008 its balance sheet through asset purchases, to hit an announced inflation target, typically two percent. Independence from the Treasury is meant to prevent the monetisation of deficits. New Zealand legislated the first target in 1989; the Federal Reserve announced an explicit two percent goal in January 2012.",
        matrix: {
          creates: "Commercial banks by lending; the central bank through its policy rate and asset purchases.",
          limit: "An inflation target, capital and liquidity rules, borrower demand and the central bank's interest rate.",
          firstRecipient: "Borrowers, sellers of assets to the central bank and, through deficits, those the government pays.",
          scale: "Operating at national scale",
          strongestFor: "The most stable inflation in the G7 sample from 1961 (SD 0.72 in 1993-2007), with room to respond to shocks, although the US classical gold standard had a lower average (0.1 percent a year, 1880-1914).",
          strongestAgainst: "It targets positive inflation by design, has no built-in reversion of the price level, and credit booms and crises were more frequent."
        },
        cases: [
          "The Great Inflation of 1965-82, with US inflation about 1 percent in 1964 and above 14 percent in 1980. The Volcker disinflation began in October 1979 and inflation was under 5 percent by the end of 1982.",
          "Inflation targeting from 1990 (New Zealand), followed by Canada, the UK, Sweden and other OECD countries in the early 1990s; the ECB in 1999; the Federal Reserve in 2012.",
          "The Great Moderation of 1984-2007, then the global financial crisis (2007-09), the euro-area crisis (2010-12), 2020 and the inflation resurgence of 2021-23.",
          "Wide variation inside the regime: Iceland averaged 38.4 percent inflation in 1974-1990, then 3.8 percent in 1991-2007, then 12.7 percent in 2008."
        ],
        outcomes: [
          { label: "US consumer prices, annual rate, 1971 to 1989", value: "{{cpi.cagr.1971.1989|p2}} a year", period: "1971 to 1989", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "US consumer prices, annual rate, 1990 to 2007", value: "{{cpi.cagr.1990.2007|p2}} a year ({{cpi.cagr.1993.2007|p2}} from 1993)", period: "1990 to 2007", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "US consumer prices, annual rate, 2008 to 2019", value: "{{cpi.cagr.2008.2019|p2}} a year", period: "2008 to 2019", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "US consumer prices, annual rate, 2020 to 2024", value: "{{cpi.cagr.2020.2024|p2}} a year", period: "2020 to 2024", scope: "United States, annual averages", basis: "computed", refs: ["bls_cpi"] },
          { label: "UK retail prices, annual rate", value: "{{ukrpia.cagr.1971.2024|p2}} a year ({{ukrpia.ratio.1971.2024|x1}} in total); {{ukrpia.cagr.1946.2024|p2}} a year over 1946 to 2024", period: "1971 to 2024", scope: "United Kingdom, annual averages", basis: "computed", refs: ["ons_rpi"] },
          { label: "Doubling time of US prices", value: "{{cpi.doubling.1913-01.latest|yrs1}} since January 1913 and {{cpi.doubling.1971-08.latest|yrs1}} since August 1971; a doubling at two percent a year takes {{calc.doubling_from_rate.2|yrs1}}", period: "to the newest month", scope: "United States", basis: "computed", refs: ["bls_cpi"] },
          { label: "G7 inflation (SD)", value: "7.65 percent (4.15) in 1971-89; 2.26 percent (1.27) in 1990-2007, or 1.84 percent (0.72) in 1993-2007; 1.41 percent (0.95) in 2008-2019; 3.34 percent (2.52) in 2020-2024", period: "1971-2024", scope: "G7", basis: "cited", refs: ["wdi_cpi_growth"] },
          { label: "G7 real growth (SD)", value: "3.22 percent (2.11) in 1971-89; 2.19 percent (1.44) in 1990-2007; 1.02 percent (1.96) in 2008-2019; 1.13 percent (4.56) in 2020-2024", period: "1971-2024", scope: "G7", basis: "cited", refs: ["wdi_cpi_growth"] },
          { label: "Crises", value: "Crises since 1973 are about twice as frequent as under Bretton Woods or the classical gold standard; 1973-2006 banking crises per country-year were 0.67 percent in advanced and 2.94 percent in emerging economies; 151 systemic banking crises worldwide in 1970-2017", period: "1970-2017", scope: "Worldwide", basis: "cited", refs: ["bordo2001", "obstfeld2013", "laeven_valencia2018"] },
          { label: "Credit", value: "Private credit rose from 62 percent of GDP in 1980 to 118 percent in 2010 in 17 advanced economies, mostly mortgages", period: "1980-2010", scope: "17 advanced economies", basis: "cited", refs: ["jst2017"] },
          { label: "Does targeting matter?", value: "Ball and Sheridan find no improvement once regression to the mean is allowed for; Roger (IMF 2009) finds targeters compare favourably and coped better with the 2007-09 shocks", period: "1990-2009", scope: "OECD countries", basis: "cited", refs: ["ball_sheridan2003", "roger2009"] }
        ],
        strengths: [
          "The most stable inflation in the G7 sample from 1961 (SD 0.72 in 1993-2007), with low output volatility and ample liquidity support in crises. The US classical gold standard had a lower average inflation (0.1 percent a year, 1880-1914).",
          "Policy can respond to shocks, there is no dependence on mining output or foreign gold, and it avoids the interwar deflation trap.",
          "Central-bank independence plus a numerical target anchors expectations; the Federal Reserve's own account credits improved policy as probably an important source of the Great Moderation."
        ],
        weaknesses: [
          "It targets positive inflation by design, so the price level doubles in {{calc.doubling_from_rate.2|yrs1}} at two percent a year ({{cpi.doubling.1991-09.latest|yrs1}} at the pace since September 1991) and has no built-in reversion.",
          "Credit booms: leverage roughly doubled in 30 years, with more negatively skewed cycles and crises about twice as frequent as under the earlier regimes. Consumer-price targets do not directly restrain asset or house prices (an inference).",
          "Critics argue that credibility failed in the Great Inflation of 1965-82 and in the 2021-23 spike; defenders reply that long-run expectations stayed anchored in 2021-23. This page holds no expectations series.",
          "The Great Moderation was partly luck (Stock and Watson attribute 40 to 60 percent of the decline to unidentified smaller shocks), and the effect of targeting itself is contested.",
          "Large unconventional balance-sheet policy since 2008, and a zero lower bound on rates.",
          "Unexpected inflation moves wealth from nominal creditors to debtors; expected inflation is priced into interest rates."
        ],
        refs: ["bls_cpi", "wdi_cpi_growth", "bordo2001", "obstfeld2013", "laeven_valencia2018", "jst2017", "ball_sheridan2003", "roger2009", "stock_watson2002", "fedhist_great_inflation", "fedhist_great_moderation", "te_ara_rbnz", "fed_longer_run_goals"]
      },

      // ------------------------------------------------------------ currency boards
      {
        id: "sys-board", name: "Currency boards", period: "Hong Kong 1983 to date; Bulgaria 1997 to 2025; comparators Estonia and Argentina",
        status: "Operating today (Hong Kong); ended (Bulgaria 2026, Argentina 2002)",
        evidence: "Episode evidence from a handful of small economies. There is no rate of crisis frequency for such small samples.",
        created: "The monetary authority issues base money only against foreign reserves at a fixed rate and redeems it on demand at that rate. In Hong Kong, since 17 October 1983 note-issuing banks must hold certificates of indebtedness issued by the Exchange Fund against US dollars at HK$7.80, and since 2005 the HKMA stands ready to buy dollars at 7.75 and sell at 7.85. Bulgaria fixed its currency to the Deutsche mark on 1 July 1997 and later to the euro, and the board ended on 1 January 2026 when Bulgaria joined the euro. Commercial banks still create deposits by lending inside the board, so 'money is debt' still applies to broad money. What the board removes is discretionary central-bank money creation and the exchange-rate float. The anchor currency is itself fiat.",
        matrix: {
          creates: "Commercial banks by lending; the board issues base money only against foreign reserves.",
          limit: "The fixed exchange rate and the reserves behind the base money.",
          firstRecipient: "Foreign-exchange sellers and, through lending, bank borrowers.",
          scale: "Operated at national scale in small open economies",
          strongestFor: "It ends hyperinflation fast and credibly, with a transparent rule and no monetary financing.",
          strongestAgainst: "It imports the anchor country's monetary policy, and adjustment falls on prices, wages and jobs."
        },
        cases: [
          "Hong Kong: a speculative attack in 1997-98, when the government bought HK$118 billion (about 18 percent of Exchange Fund assets) of 33 Hang Seng stocks between 14 and 28 August 1998. The convertibility undertaking was strengthened in September 1998 and a symmetric band was set in May 2005.",
          "Bulgaria: introduced on 1 July 1997 after annual-average inflation of 121.6 percent in 1996 and 1,058 percent in 1997 and a fall in real GDP of 14.1 percent in 1997.",
          "Estonia: a board from 20 June 1992, later tied to the euro. Argentina: convertibility at one peso per dollar from 1991, abandoned after the sovereign default of December 2001.",
          "The boards in Hong Kong, Bulgaria and Estonia lasted decades; Argentina's lasted about ten years."
        ],
        outcomes: [
          { label: "Hong Kong inflation and growth", value: "Inflation averaged 3.58 percent a year (SD 3.95) and real growth 3.79 percent (SD 4.14)", period: "1984-2024", scope: "Hong Kong", basis: "cited", refs: ["wdi_cpi_growth"] },
          { label: "Hong Kong stress episode", value: "Real GDP fell 5.9 percent in 1998; consumer prices fell 16.4 percent from July 1998 to July 2003; property prices fell almost 70 percent from the third-quarter 1997 peak; unemployment rose from 2.1 percent in 1997 to 8.5 percent in 2003", period: "1997-2003", scope: "Hong Kong", basis: "cited", refs: ["hkma_milestones"] },
          { label: "Bulgaria", value: "Inflation fell from 1,058 percent in 1997 to 18.7 percent in 1998 and 2.6 percent in 1999; over 1998-2025 it averaged 5.07 percent (SD 4.73) with growth of 2.92 percent (SD 3.57)", period: "1997-2025", scope: "Bulgaria", basis: "cited", refs: ["wdi_cpi_growth", "bta_bulgaria1997", "ec_bulgaria_euro"] },
          { label: "Baltic states in 2009", value: "Real GDP fell 14.6 percent in Estonia (board) and 16.0 percent in Latvia (peg without a board)", period: "2009", scope: "Estonia, Latvia", basis: "cited", refs: ["wdi_cpi_growth"] },
          { label: "Argentina", value: "Cumulative real GDP fell 18.4 percent over 1999-2002; the regime was abandoned in early 2002", period: "1999-2002", scope: "Argentina", basis: "cited", refs: ["ieo_argentina"] },
          { label: "Cross-country evidence", value: "Currency boards were associated with better inflation performance than other pegs, even allowing for endogenous regime choice, and with higher output growth", period: "1970s-1990s", scope: "IMF study of pegs", basis: "cited", refs: ["ghosh1998"] }
        ],
        strengths: [
          "It ends hyperinflation fast and credibly: Bulgaria's annual-average inflation fell from 1,058 percent to 2.6 percent in two years.",
          "A transparent rule, no seigniorage for the central bank and no monetary financing of deficits.",
          "Hong Kong survived the 1997-98 attacks with the link intact, though through an unorthodox equity intervention, and has run for four decades.",
          "Better inflation and growth than other pegs in the IMF cross-country study."
        ],
        weaknesses: [
          "It imports the anchor country's monetary policy. The HKMA conceded in 2000 that US policy may not suit Hong Kong and that asset-price inflation under negative real interest rates is a legitimate concern.",
          "Adjustment falls on prices, wages and employment: Hong Kong's deflation and 70 percent property fall, Baltic output falls of about 15 percent in 2009, and Argentina's 18 percent fall and abandonment.",
          "A limited lender of last resort and limited fiscal room, and vulnerability to speculative attack unless reserves exceed the base.",
          "Exit costs: Bulgaria and Estonia exited by joining the euro and Argentina by default.",
          "It fixes the exchange rate, not bank credit creation, so it does not by itself stop credit booms."
        ],
        refs: ["hkma_milestones", "ec_bulgaria_euro", "bta_bulgaria1997", "ghosh1998", "ieo_argentina", "wdi_cpi_growth"]
      },

      // ------------------------------------------------------------ sovereign money
      {
        id: "sys-sovereign", name: "Full-reserve and sovereign money proposals", period: "Chicago Plan 1933; Benes and Kumhof 2012; Iceland 2015; Swiss vote 2018",
        status: "Modelled only; voted down in Switzerland",
        evidence: "Models and one referendum. No country has implemented either design.",
        created: "Banks may not create money. Transaction deposits are fully backed by government-issued money (reserves or sovereign money). In Fisher's and the Chicago economists' version, banks lend only money they have borrowed or earned. In the Sovereign Money version (the Iceland report, building on Dyson and Jackson), the central bank alone creates money and an independent committee decides how much. New money enters through government spending, tax cuts, debt repayment or a citizen dividend; transaction accounts sit at the central bank and are risk free; lending is funded by savers with fixed commitment periods and creates no new money.",
        matrix: {
          creates: "The central bank alone, on the decision of an independent committee.",
          limit: "The committee's rule for the quantity of money; lending is limited to what savers commit.",
          firstRecipient: "Whoever the rule names: the government, taxpayers or citizens through a dividend.",
          scale: "Modelled only; one national referendum, rejected",
          strongestFor: "It separates money creation from credit creation, so credit booms would not create money and runs on transaction accounts would be impossible.",
          strongestAgainst: "It is untested, the gains are simulated, and the quantity decision moves into a committee."
        },
        cases: [
          "1933: University of Chicago economists circulated memoranda calling for 100 percent reserves. Fisher's '100% Money' appeared in 1935. Simons doubted by 1934 that 100 percent reserves would suffice because markets could innovate around legal limits.",
          "August 2012: Benes and Kumhof, IMF Working Paper 12/202, 'The Chicago Plan Revisited' (model-based; the IMF disclaims official endorsement).",
          "March 2015: Iceland, 'Monetary Reform: A Better Monetary System for Iceland', a report commissioned by the Prime Minister. It recommends a feasibility study, not immediate adoption.",
          "10 June 2018: the Swiss 'Vollgeld' (sovereign money) initiative was rejected by about three voters in four. The Swiss National Bank opposed it. The vote says how voters judged the risk, not what the economics would have been.",
          "Iceland, 1994-2008: broad money rose about tenfold while nominal GDP roughly tripled. The case is cited as one where bank money creation ran far ahead of output, but standard accounts also stress that the banks borrowed heavily abroad, so it illustrates the problem the proposals address and does not show that they would have prevented it."
        ],
        outcomes: [
          { label: "Kumhof and Benes model", value: "A calibrated model of the US finds long-run output gains approaching 10 percent, lower real interest rates and taxes, steady-state inflation that can fall to zero, no bank runs, and sharp falls in net public and private debt. The result depends on treating government-issued money as equity in the commonwealth and on an idealised one-period transition.", period: "model", scope: "United States (simulated)", basis: "cited", refs: ["benes_kumhof2012"] },
          { label: "Iceland boom", value: "Broad money rose about tenfold between 1994 and 2008 while nominal GDP roughly tripled", period: "1994-2008", scope: "Iceland", basis: "cited", refs: ["sigurjonsson2015"] },
          { label: "Swiss vote (a popularity result, not an economic outcome)", value: "24.28 percent yes, 75.72 percent no", period: "10 June 2018", scope: "Switzerland", basis: "cited", refs: ["bloomberg_swiss2018"] },
          { label: "Measured national outcomes", value: "None: the regime has never been run at scale", period: "-", scope: "-", basis: "cited", refs: ["benes_kumhof2012"] }
        ],
        strengths: [
          "It answers the 'money is debt' critique directly: transaction money would no longer be created by lending, so credit booms would not create money and runs on transaction accounts would be impossible.",
          "Seigniorage accrues to the public rather than to banks, and the model shows a large reduction in net public and private debt.",
          "A clear separation of the money-creation and credit functions; the central bank would control broad money directly."
        ],
        weaknesses: [
          "It is untested: all gains are simulated and there is no historical full-reserve economy to measure.",
          "Transition and enforcement risk. Niepelt is very sceptical that it can be enforced, and Simons doubted that 100 percent reserves suffice because markets innovate around limits (shadow banking is an inference).",
          "Critics (Bacchetta 2017; the Swiss National Bank 2018) argue that it would constrain monetary policy, make lending harder and costlier, and lower depositors' returns.",
          "Political risk: it moves the decision on the quantity of money into a committee and, in the Iceland design, the allocation to parliament. The record of debt-free printing shows what happens when that discipline fails."
        ],
        refs: ["benes_kumhof2012", "sigurjonsson2015", "bloomberg_swiss2018", "niepelt2015", "bacchetta2017", "tavlas2010", "jackson_dyson2013"]
      },

      // ------------------------------------------------------------ printing
      {
        id: "sys-printing", name: "Debt-free government money printing", period: "Continentals 1775-81; Greenbacks 1862-79; Confederacy; Weimar 1921-23; Zimbabwe 2007-09; Venezuela 2017-20",
        status: "Operated historically in episodes",
        evidence: "Episode evidence. All cases coincided with war, revolution, default, sanctions or political collapse, so none is a controlled experiment.",
        created: "The state (or a central bank acting on its order) pays for spending with newly issued notes or account credits instead of selling bonds to the public or taxing. No matching private debt is created and the seigniorage goes to the state. The inflation tax, the loss of purchasing power of money holders, pays for the spending. Mankiw notes three limits even in a modern economy: money printed to pay bills ends up as bank reserves on which interest is paid (so it is in effect borrowing), or else it expands bank lending, and higher inflation shrinks the real balances that can be taxed.",
        matrix: {
          creates: "The state or a central bank acting on its order, to pay for spending.",
          limit: "Only political restraint, and the collapse of money demand if issue is open-ended.",
          firstRecipient: "The state and those it pays: soldiers, suppliers, officials.",
          scale: "Operated at national scale in episodes",
          strongestFor: "Immediate financing in an emergency, with no default on nominal debts and no interest paid to banks.",
          strongestAgainst: "When issue is open-ended and the state has lost market access, money demand collapses and inflation accelerates beyond control."
        },
        cases: [
          "Continental dollar, 1775-81: emissions of $200 million face value in 1775-79 financed 77 percent of Congressional spending; none after November 1779; 40 Continental dollars per Spanish silver dollar by March 1780; abandoned in 1781.",
          "Union greenbacks, 1862-79: issue capped at $450 million; the gold premium peaked in July 1864; par with gold was reached in December 1878 and resumption took place on 1 January 1879. Northern prices rose about 80 percent during the war, against about 9,000 percent in the Confederacy, and the national debt still rose from $90.6 million in 1861 to almost $2.8 billion in 1866.",
          "Confederacy, 1861-65: the money stock rose 11.5 times and commodity prices 28 times from January 1861 to October 1864. Money printing supplied about 60 percent of real revenue and taxes about 8 percent.",
          "Weimar Germany, 1921-23: peak monthly inflation about 29,500 percent. The inflation ended with the Rentenmark in November 1923 and by stopping Reichsbank discounting of Treasury bills.",
          "Zimbabwe, 2007-09: official statistics stopped; Hanke and Kwok estimate a peak of about 79.6 billion percent a month in mid-November 2008. The currency was abandoned in 2009. The causes are disputed.",
          "Venezuela, 2013 onward: hyperinflation by Cagan's criteria from December 2017 to January 2020, driven mainly by a jump in monetary base growth."
        ],
        outcomes: [
          { label: "Greenbacks", value: "Prices rose about 80 percent in four years, about 15.8 percent a year, then were restored to par by contraction and resumption", period: "1862-79", scope: "United States (Union)", basis: "cited", refs: ["majewski_war", "wikipedia_greenbacks"] },
          { label: "Confederacy", value: "Prices rose 28 times in under four years and real output fell about 40 percent", period: "1861-65", scope: "Confederate States", basis: "cited", refs: ["weidenmier2002"] },
          { label: "Weimar Germany", value: "Peak inflation about 29,500 percent a month; ended by fiscal and monetary regime change, not gradual tightening", period: "1921-23", scope: "Germany", basis: "cited", refs: ["hanke_krus2012", "sargent1982"] },
          { label: "Zimbabwe", value: "Real GDP fell about 50 percent over 2000-08; the IMF-based inflation figure for 2008 (231,150,889 percent) is far below Hanke and Kwok's estimate, which shows the data gap", period: "2000-2009", scope: "Zimbabwe", basis: "cited", refs: ["hanke_kwok2009", "imf_datamapper_weo"] },
          { label: "Venezuela", value: "Inflation of 65,374 percent in 2018 (IMF); real GDP fell about 75 percent over 2014-2020", period: "2014-2020", scope: "Venezuela", basis: "cited", refs: ["olivo2023", "imf_datamapper_weo"] },
          { label: "Definition used", value: "Hyperinflation is monthly inflation above 50 percent (Cagan 1956), equal to 12,874.6 percent a year; Hanke and Krus catalogue 56 episodes", period: "-", scope: "World", basis: "cited", refs: ["hanke_krus2012"] }
        ],
        strengths: [
          "Immediate financing in emergencies with no default on nominal debts; the greenbacks financed part of the Union war effort and were later restored to par.",
          "No interest is paid to banks on the newly created money.",
          "Limited issuance with a clear return-to-parity plan (the greenbacks) caused moderate inflation of about 80 percent over four years, not hyperinflation.",
          "In the modern case of 2020-21, large money creation was followed by a fall in unemployment and by inflation that later receded."
        ],
        weaknesses: [
          "When issuance is open-ended and the state has lost market access, money demand collapses and inflation accelerates beyond control (Weimar, Zimbabwe, Venezuela, the Confederacy).",
          "Inflation is a tax on money holders and falls mostly on savers and wage earners; real wages fell in the wartime North.",
          "The cases that ended did so through fiscal reform, a new currency and a stop to central-bank financing (Sargent); issuance itself did not fix the underlying deficit.",
          "Output collapsed in Zimbabwe and Venezuela (about 50 and 75 percent), though causation runs both ways.",
          "The issuer is also the spender, so discipline is weak."
        ],
        refs: ["grubb2011", "majewski_war", "wikipedia_greenbacks", "weidenmier2002", "hanke_krus2012", "sargent1982", "hanke_kwok2009", "olivo2023", "imf_datamapper_weo", "mankiw2020"]
      },

      // ------------------------------------------------------------ MMT
      {
        id: "sys-mmt", name: "Money-financed deficits and Modern Monetary Theory", period: "no explicit adopter; the 2020-22 US experience and Japan as partial analogues",
        status: "Debated; not adopted as a regime",
        evidence: "Opinion and a few episodes. No country has adopted MMT as an explicit regime, so there is no measured sample; that absence is itself a result. The position is described here mostly through its critics (Mankiw) and a survey; its proponents' own statements (Wray 2015; Kelton 2020) are named but were not re-read for this page.",
        created: "The institutional plumbing is the same as for fiat money (Treasury, central bank, commercial banks), but MMT describes and prescribes it differently: the government as currency issuer spends by crediting accounts, and taxes and bond sales manage demand and interest rates rather than fund spending. The binding constraint is real resources and inflation, not solvency. A job guarantee is the proposed stabiliser. In Mankiw's reading, MMT authors say 'the issuer of a currency faces no financial constraints' and that all spending is inflationary if it pushes nominal demand above the economy's real capacity.",
        matrix: {
          creates: "The government through spending, with the central bank accommodating.",
          limit: "Real capacity and inflation, managed by taxes, bond sales and an employment buffer.",
          firstRecipient: "The recipients of government spending.",
          scale: "Not adopted; partial analogues only",
          strongestFor: "A currency issuer can always make nominal payments in its own currency, and real capacity and inflation are the actual constraints.",
          strongestAgainst: "It has no tested operational rule for how much deficit is too much, and it is hard to tell when the inflation constraint binds."
        },
        cases: [
          "Japan is the usual reference: the Bank of Japan held 47.9 percent of government bonds plus bills at December 2023. That is central-bank purchase of government debt in the market, which swaps bonds for reserves; it is not printing to pay for spending.",
          "United States, 2020-22: M2 rose 40.5 percent from February 2020 to April 2022, alongside large fiscal transfers. Attribution of the inflation that followed is contested: Jorda and co-authors estimate that fiscal support raised US inflation by about 3 points by end-2021 relative to peers; Bernanke and Blanchard find that most of the surge came from product-market shocks.",
          "Expert survey: in March 2019 the IGM Forum asked 42 US economists (38 responded) whether countries that borrow in their own currency can finance as much real spending as they want by creating money. None agreed."
        ],
        outcomes: [
          { label: "US consumer prices, year on year, June 2022", value: "{{cpi.yoy.2022-06|p2}}, the highest reading since 1981", period: "June 2022", scope: "United States", basis: "computed", refs: ["bls_cpi"] },
          { label: "US consumer prices since February 2020", value: "{{cpi.pct.2020-02.latest|p1}} to the newest month", period: "February 2020 to latest", scope: "United States", basis: "computed", refs: ["bls_cpi"] },
          { label: "US 2020-23 sequence (one episode)", value: "M2 growth peaked at 26.8 percent in February 2021; consumer inflation was 1.7 percent in February 2021, 9.0 percent in June 2022 and 5.0 percent in April 2023, when M2 was falling 4.6 percent. Supply shocks, energy prices and a rise of about 5 points in the federal funds rate overlapped in these months, so this is one observation and not a measured lag", period: "2020-23", scope: "United States", basis: "cited", refs: ["fred_m2sl", "fred_fedfunds"] },
          { label: "Money growth and inflation", value: "A correlation of 0.79 between US decadal inflation and money growth since 1870 (Mankiw). A descriptive check found 0.54 for M2 dates in 1960-79, -0.29 for 1980-89 and -0.13 for 1990-2019 (M2 growth against inflation 24 months later)", period: "1870-2019", scope: "United States", basis: "cited", refs: ["mankiw2020", "fred_m2sl"] },
          { label: "Expert opinion", value: "0 of 38 respondents agreed with either unlimited-financing statement. This is opinion, not an outcome", period: "13 March 2019", scope: "US economists", basis: "cited", refs: ["igm_mmt2019"] }
        ],
        strengths: [
          "The accounting point that a currency issuer can always make nominal payments in its own currency is correct (Mankiw concedes it), and default in one's own currency is a choice.",
          "It directs attention to real capacity and inflation as the constraint, which is where the large episodes (Weimar, Venezuela) ended up.",
          "It is consistent with long periods of low inflation despite large central-bank asset purchases after 2008.",
          "It highlights that unemployment and idle capacity are typical states, a view shared by New Keynesian models."
        ],
        weaknesses: [
          "There is no tested operational rule for how much deficit is too much; the inflation constraint can show up with a lag, and the sources disagree on how much of the 2021-22 spike was fiscal.",
          "Mankiw's three objections: interest on reserves turns printing into borrowing; otherwise bank lending and the money supply expand; and higher inflation shrinks the real seigniorage base so the government can end up on the wrong side of a seigniorage Laffer curve.",
          "Remedies such as price controls and incomes policies have a poor practical record (Mankiw).",
          "The issuer is also the spender.",
          "Economists nearly unanimously rejected the strong form in the IGM poll, though the questions were put in a form that MMT authors themselves qualify."
        ],
        refs: ["mankiw2020", "igm_mmt2019", "jorda_liu2022", "bernanke_blanchard2023", "japan_mof2024", "fred_m2sl", "fred_fedfunds", "bls_cpi", "wray2015", "kelton2020"]
      },

      // ------------------------------------------------------------ digital
      {
        id: "sys-digital", name: "Fixed-supply digital money", period: "Bitcoin 2009 to date; El Salvador 2021 to 2026",
        status: "Operating (as a market asset); legal-tender experiments rolled back",
        evidence: "A short record: about fifteen years of price data and two legal-tender experiments.",
        created: "Bitcoin's protocol issues new coins only as a block subsidy to miners: 50 coins per block at launch, halved every 210,000 blocks (about four years), now 3.125 per block since the April 2024 halving, with a maximum of 20,999,999.9769 coins. Once the subsidy fades miners are paid by fees. The base layer has no lending-based money creation, so there is no bank-style expansion or contraction of the base, although credit denominated in bitcoin can still be created by lenders and custodians (an inference). El Salvador layered bitcoin on a dollarised economy: the Bitcoin Law took effect on 7 September 2021 and required businesses to accept it.",
        matrix: {
          creates: "A protocol: block subsidies to miners on a fixed schedule.",
          limit: "A fixed maximum supply and a known issuance schedule.",
          firstRecipient: "Miners and early holders.",
          scale: "Not a national money; legal tender in two countries, rolled back",
          strongestFor: "A supply path known in advance that no government or bank on the base layer can alter.",
          strongestAgainst: "A fixed supply does not stabilise value, and prices and wages remain set in other currencies."
        },
        cases: [
          "Bitcoin: white paper in October 2008, network from January 2009; halvings at blocks 210,000, 420,000, 630,000 and 840,000 (April 2024).",
          "El Salvador: legal tender from 7 September 2021. Amendments passed at the end of January 2025, by 55 votes to 2, removed the word 'currency', made acceptance voluntary and barred paying taxes in bitcoin, effective 1 May 2025. An IMF programme was approved on 26 February 2025; on 1 October 2026 the IMF Board completed the second and third reviews and noted that no further bitcoin accumulation was envisaged beyond documented donations.",
          "Central African Republic: bitcoin was made legal tender in April 2022 and repealed by parliament in March 2023."
        ],
        outcomes: [
          { label: "Issuance", value: "About 0.82 percent of supply a year at the 3.125-per-block subsidy; supply about 20.1 million coins", period: "2026", scope: "Bitcoin", basis: "cited", refs: ["bitcoin_wiki_supply"] },
          { label: "Price volatility", value: "Annualised standard deviation of daily log returns of 149.8 percent in 2013, 92.9 percent in 2017, 64.6 percent in 2022, 43.6 percent in 2023 and 41.9 percent in 2025 (the G7 standard deviation of annual consumer-price inflation in 1993-2007 was 0.72 points; the units differ)", period: "2011-2026", scope: "Bitcoin in US dollars", basis: "cited", refs: ["bitstamp_ohlc"] },
          { label: "Drawdowns", value: "Falls from peak daily close of 71 percent (2013), 85 percent (2013-15), 83 percent (2017-18), 53 percent (2021), 77 percent (2021-22) and 53 percent (October 2025 to June 2026)", period: "2013-2026", scope: "Bitcoin in US dollars", basis: "cited", refs: ["bitstamp_ohlc"] },
          { label: "El Salvador usage", value: "About 20 percent of firms accepted bitcoin, 4.9 percent of sales were paid in it and 88 percent of businesses converted proceeds to dollars; a January 2025 survey found 92 percent of Salvadorans did not use bitcoin in 2024", period: "2021-2024", scope: "El Salvador", basis: "cited", refs: ["alvarez2022", "gfmag_elsalvador"] },
          { label: "El Salvador macro", value: "Inflation averaged 2.24 percent in 2001-2020 against 2.06 percent in the US, consistent with a dollarised economy importing US inflation; any effect of the bitcoin policy cannot be separated from dollar and global shocks", period: "2001-2020", scope: "El Salvador", basis: "cited", refs: ["wdi_cpi_growth", "imf_pr26316"] }
        ],
        strengths: [
          "The supply path is known in advance and cannot be altered by a government or bank on the base layer.",
          "No seigniorage for a central authority, no bank run on the base asset, and global settlement.",
          "It appeals to those who see discretionary issuance, and bank credit creation, as the source of dilution."
        ],
        weaknesses: [
          "A fixed supply does not stabilise value: dollar-price volatility of 42 to 150 percent a year and repeated 50 to 85 percent drawdowns make it a poor unit of account. Wages and rents are not priced in it.",
          "If demand grows faster than the supply of about 0.8 percent a year, the value of the unit tends to rise, which discourages spending and makes debts in it harder to service (a deflationary bias; an inference from theory).",
          "There is no lender of last resort or counter-cyclical policy, and no mechanism to match money to output.",
          "Adoption as legal tender was low and fell, and it was unwound under IMF conditionality (El Salvador) or repealed within a year (the Central African Republic).",
          "Lending in the unit by custodians is possible, so a fixed supply of the coin did not remove debt."
        ],
        refs: ["bitcoin_wiki_supply", "nakamoto2008", "bitstamp_ohlc", "alvarez2022", "imf_pr26316", "gfmag_elsalvador", "centralbanking_car", "wdi_cpi_growth"]
      }
    ]
  },

  method: {
    title: "Method and limits",
    paragraphs: [
      "Every number marked as computed is calculated in your browser from the data files on this site by a named rule, for example the doubling time of US consumer prices from August 1971 to the newest month. The period, the series and its source are shown beside the number, and a figure that cannot be computed is shown as n/a.",
      "Doubling time is years times ln 2 divided by ln(end / start). Average growth a year is (end / start) to the power of 1 / years, minus one. A dollar keeps start / end of its purchasing power. Ranges that end 'to latest' compare single months; ranges between two years compare annual averages.",
      "Hours of work are a price divided by the hourly pay of production and nonsupervisory workers. A work-year is {{calc.hours_per_year|n0}} hours (40 hours times 52 weeks), an assumption. The effective interest rate on government debt is interest paid in year t divided by the debt at the end of year t-1, times one plus nominal growth; r minus g is that rate minus nominal growth. A real return is (1 + nominal rate) / (1 + inflation) - 1, using the annual-mean bill rate and the change in annual-average CPI-U.",
      "Series are never spliced. Where a product, a definition or a source changes, the pieces are separate series and are shown in separate rows or lines: the Shiller compilation (to 1974) and the FHFA index (from 1975) are never joined, and neither are the IMF long-run debt series and the IMF World Economic Outlook series."
    ],
    doesNotClaim: [
      "That the money system is silly, fair or unfair. The page tests specific claims and does not score the system.",
      "That any money system is the best. The comparison has no winner, and each system has costs.",
      "That any figure here is investment, tax or financial advice.",
      "That a verdict is final. Each card lists what would change it."
    ],
    dataNotes: [
      "The CPI-U series has no October 2025 observation because collection stopped during a federal funding lapse, so 2025 is not a complete year for annual comparisons. Annual CPI comparisons across series end in 2024. The one exception is the real return on bills, which counts 2025 as a part year of eleven months of prices and says so.",
      "Before January 1983 the CPI-U counted house purchase prices and mortgage interest costs. Since then it measures shelter through rents. The 1970s are therefore not on the same basis as later years.",
      "UK house prices after inflation use the CPI from 1990 (it starts in 1988) and the RPI for the 1970 window, with the RPI shown beside the CPI for comparison. The RPI includes mortgage interest and a house depreciation cost based on house prices, which the CPI leaves out.",
      "The 3-month Treasury bill rate used for real returns is the published discount rate. It understates the investment yield a saver earns, by {{tbill.yieldgap.1934.2025|n2}} points a year on average over 1934 to 2025 and more when rates are high. The real returns shown here are before tax.",
      "BIS credit values are fourth-quarter levels for each year. BIS and IMF Global Debt Database series are separate compilations and are not joined. IMF values after the last actual year are removed, and the newest IMF year may still be an estimate.",
      "The IMF long-run debt series changes coverage in places (general government where available, central government otherwise); the data file lists the inferred breaks.",
      "The history file holds selected years, not every year, and its 2026 points are partial-year readings. Ratios between its series are for the years named, and the newest partial-year points are not used in the annual comparisons. Its M2 and Federal Reserve values are hand-entered and rounded, so a ratio can differ from one built on the FRED series at the first decimal.",
      "Pay is the average hourly pay of production and nonsupervisory workers, not a median wage. The median new-house price is not adjusted for quality, and the Census median household income is a survey measure.",
      "No mortgage-rate, Case-Shiller, Jorda-Schularick-Taylor or Nationwide series ships with this site because of licence terms; where a claim depends on them, the figure is quoted and marked as a published figure."
    ],
    researchLimits: [
      "Some primary sources could not be opened during research (the Cato Institute and CBO pages returned an access error), so a few figures rest on search summaries or on secondary reproductions. The Sources list shows how far each source was checked, and a card marks a source (not re-read) when it was named in the research and not opened for this page.",
      "Several decades-long series are not comparable across countries, and some historical figures (hyperinflation peaks, pre-1913 national accounts) are estimates.",
      "Published figures labelled as research calculations were computed by the research team from the named FRED, Treasury or World Bank series on 24 October 2026 and were not recomputed by this site."
    ]
  },

  glossary: [
    { term: "Money", def: "A claim that everyone accepts for settling debts. In practice it comes in layers: cash, bank reserves and bank deposits." },
    { term: "Asset and liability", def: "An asset is something you own or are owed. A liability is something you owe. A bank deposit is an asset for its holder and a liability for the bank." },
    { term: "Base money", def: "Cash plus the reserve balances that banks hold at the central bank. Both are liabilities of the central bank." },
    { term: "Reserves", def: "The balances that commercial banks hold at the central bank, used to settle payments between banks." },
    { term: "Deposit", def: "A balance at a commercial bank. It is a claim on the bank and is the most common form of money." },
    { term: "M2", def: "A broad measure of money in the US: cash, checking and savings deposits, small time deposits and retail money-market funds." },
    { term: "Broad money", def: "Money in the wide sense, mostly bank deposits. Each economy publishes its own aggregate (M2, M3, M4), so levels are not strictly comparable." },
    { term: "Fractional-reserve banking", def: "A system in which banks hold only part of their deposits as reserves and make loans with the rest of their balance sheet, creating new deposits when they lend." },
    { term: "Full-reserve banking", def: "A proposed system in which transaction deposits are fully backed by government-issued money and banks cannot create money by lending." },
    { term: "Sovereign money", def: "A proposed system in which the central bank alone creates money, on the decision of an independent committee, and banks only lend funds committed by savers." },
    { term: "Fiat money", def: "Money that is not convertible into a commodity and is accepted because the state declares it legal tender and people expect others to accept it." },
    { term: "Gold standard", def: "A system in which a currency is defined as a fixed weight of gold and is convertible into it at that price." },
    { term: "Gold exchange standard", def: "A gold standard in which central banks hold part of their reserves in foreign currencies that are themselves convertible into gold." },
    { term: "Peg", def: "A fixed or tightly managed exchange rate between two currencies." },
    { term: "Currency board", def: "A rule under which the authority issues base money only against foreign reserves at a fixed exchange rate and redeems it on demand." },
    { term: "Inflation", def: "A rise in the general level of prices, usually measured as the yearly change in a consumer price index." },
    { term: "CPI-U", def: "The US Consumer Price Index for All Urban Consumers, published by the Bureau of Labor Statistics. It prices a basket of goods and services and measures shelter through rents, not house purchase prices." },
    { term: "Purchasing power", def: "How much a unit of money buys. It moves opposite to the price level." },
    { term: "Nominal and real", def: "Nominal values are in money of the day. Real values are adjusted for changes in prices." },
    { term: "Average growth per year", def: "The steady yearly rate that would take a value from its start to its end over a period. It is also called the compound annual growth rate." },
    { term: "Doubling time", def: "The number of years a value takes to double at its average growth rate: years times ln 2 divided by ln of the end value over the start value. The rule of 70 (70 divided by the percent growth) is a shortcut." },
    { term: "Inflation targeting", def: "A regime in which the central bank announces a numerical inflation goal, typically two percent a year, and steers interest rates toward it. It fixes the rate of price change, not the price level." },
    { term: "Great Inflation", def: "The period of high US inflation from about 1965 to 1982." },
    { term: "Great Moderation", def: "The period of lower volatility in US output and inflation from about 1984 to 2007." },
    { term: "Quantitative easing", def: "Large central-bank purchases of bonds, paid for with newly created reserves, used when short-term rates are near zero." },
    { term: "Seigniorage", def: "The profit an issuer makes from creating money: the gap between the face value of money and the cost of producing it." },
    { term: "Monetary financing", def: "Paying for government spending with money created by the central bank instead of by taxes or borrowing from the public." },
    { term: "Hyperinflation", def: "A very fast rise in prices. The usual definition is more than 50 percent a month." },
    { term: "Cantillon effect", def: "The idea that new money reaches some people before others, so those first in line gain before prices adjust." },
    { term: "Fisher effect", def: "The idea that nominal interest rates rise with expected inflation, so expected inflation transfers little between lenders and borrowers." },
    { term: "Financial repression", def: "Policies that hold interest rates below inflation, so that governments and borrowers gain at the expense of savers." },
    { term: "Real return", def: "The return on an asset after removing inflation: (1 + nominal rate) divided by (1 + inflation), minus one." },
    { term: "Treasury bill", def: "A short-term US government security. The 3-month bill rate is a standard safe short-term rate." },
    { term: "TIPS", def: "Treasury Inflation-Protected Securities, whose principal rises with consumer prices. Their yield is a market measure of the real interest rate." },
    { term: "Debt-to-GDP ratio", def: "Debt divided by a year of national output. It measures the size of the debt relative to the economy." },
    { term: "Gross and net debt", def: "Gross debt is everything owed. Net debt subtracts financial assets the government holds. Net figures are smaller and less often comparable across countries." },
    { term: "General and central government", def: "General government includes states, cities and social funds as well as the central government. Debt figures differ by which one is counted." },
    { term: "Primary balance", def: "Government revenue minus spending other than interest. A positive number is a surplus." },
    { term: "Net interest", def: "Interest the government pays on its debt, less interest it receives." },
    { term: "Effective interest rate", def: "Interest paid in a year divided by the debt at the end of the previous year. It reflects the old, locked-in rates as well as the new ones." },
    { term: "r minus g", def: "The interest rate on debt minus nominal GDP growth. If it is negative, debt relative to GDP can fall even with a small primary deficit. If it is positive, debt relative to GDP rises on its own." },
    { term: "Debt service ratio", def: "Scheduled interest and principal payments of a sector as a percent of its income (BIS)." },
    { term: "Velocity", def: "How often the average unit of money is spent in a year: GDP divided by money. It is the inverse of money relative to GDP." },
    { term: "Moral hazard", def: "The tendency to take more risk when someone else bears the cost of losses, as when a bank expects a rescue." },
    { term: "Hours of work", def: "A price divided by the hourly pay of production and nonsupervisory workers: how long the average such worker works to earn it." },
    { term: "Proxy", def: "A measured series used in place of the thing that cannot be measured directly, such as farmland value per acre in place of land prices. Proxies are labelled." },
    { term: "Projection", def: "A forecast. Projections are marked as projections and are never drawn as history." }
  ],
  // Sources registry. checked says how far the research looked: data (series pulled), full, abstract, summary (a page or a search summary), cited (named in the research briefs, not re-read).
  sources: {
    bls_cpi: { title: "CPI-U, all items, not seasonally adjusted (cu.data.1.AllItems)", publisher: "US Bureau of Labor Statistics", url: "https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    bls_ces: { title: "Average hourly earnings of production and nonsupervisory employees, total private (Current Employment Statistics)", publisher: "US Bureau of Labor Statistics", url: "https://download.bls.gov/pub/time.series/ce/ce.data.05c.TotalPrivate.ProductionEmployeeHoursAndEarnings", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    bls_ap: { title: "Average Price Data, US city average (bread, eggs, milk, soft drinks and others)", publisher: "US Bureau of Labor Statistics", url: "https://download.bls.gov/pub/time.series/ap/ap.data.3.Food", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    bls_cpi_home: { title: "Consumer Price Index (shelter measured through rents and owners equivalent rent)", publisher: "US Bureau of Labor Statistics", url: "https://www.bls.gov/cpi/", kind: "primary", checked: "cited", note: "Background knowledge; the shelter method was not re-checked. The date of the change is in the BLS note on owners' equivalent rent." },
    bls_oer_1983: { title: "Owners' equivalent rent and the Consumer Price Index: 30 years and counting (Beyond the Numbers)", publisher: "US Bureau of Labor Statistics", url: "https://www.bls.gov/opub/btn/volume-2/owners-equivalent-rent-and-the-consumer-price-index-30-years-and-counting.htm", kind: "primary", retrieved: "2026-10-24", checked: "summary", note: "Read through a search summary: the CPI-U measured owner-occupied housing with house prices and mortgage interest costs until January 1983, and with rental equivalence after." },
    bea_pce: { title: "Personal Consumption Expenditures: Chain-type Price Index (PCEPI)", publisher: "Bureau of Economic Analysis, via FRED", url: "https://fred.stlouisfed.org/series/PCEPI", kind: "dataset", retrieved: "2026-10-24", checked: "full", note: "Not shipped with this site. The research team averaged the monthly values by calendar year and compared 1973 with 2024 (about 22.5 and 123.7 on a 2017 = 100 base)." },
    fred_fedfunds: { title: "Federal funds effective rate (FEDFUNDS), monthly", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/FEDFUNDS", kind: "dataset", retrieved: "2026-10-24", checked: "full", note: "Not shipped with this site. 0.20 percent in March 2022 and 5.33 percent in August 2023." },
    census_nrs: { title: "New Residential Sales: sales price of new privately-owned houses sold", publisher: "US Census Bureau and HUD", url: "https://www.census.gov/construction/nrs/xls/price_cust.xlsx", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    census_cps: { title: "Current Population Survey ASEC, Table H-5, median household income", publisher: "US Census Bureau", url: "https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fhfa_hpi: { title: "House Price Index, all-transactions, USA (expanded master file)", publisher: "Federal Housing Finance Agency", url: "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    shiller_data: { title: "Irrational Exuberance, data for Figure 3.1 (nominal home price index)", publisher: "Robert J. Shiller", url: "https://shillerdata.com/", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Terms of reuse not confirmed; used as derived annual values with attribution." },
    fed_h15: { title: "Selected Interest Rates (H.15), 3-month Treasury bill", publisher: "Board of Governors of the Federal Reserve System", url: "https://www.federalreserve.gov/releases/h15/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    ons_cpi: { title: "CPI INDEX 00: ALL ITEMS 2015=100 (D7BT, dataset MM23)", publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Open Government Licence v3.0. Available from 1988 only." },
    ons_rpi_shortcomings: { title: "Shortcomings of the Retail Prices Index as a measure of inflation", publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/economy/inflationandpriceindices/articles/shortcomingsoftheretailpricesindexasameasureofinflation/2018-03-08", kind: "primary", retrieved: "2026-10-24", checked: "summary", note: "Read through a search summary: the RPI includes owner-occupiers' mortgage interest and a house depreciation cost based on house prices, which the CPI leaves out." },
    ons_rpi: { title: "Retail Prices Index: long run series (CDKO, dataset MM23)", publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/cdko/mm23", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Open Government Licence v3.0." },
    hmlr_ukhpi: { title: "UK House Price Index, average price", publisher: "HM Land Registry", url: "https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-2026-08.csv", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Open Government Licence v3.0." },
    statcan_cpi: { title: "Table 18-10-0004-01, Consumer Price Index, monthly, Canada", publisher: "Statistics Canada", url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    statcan_nhpi: { title: "Table 18-10-0205-01, New housing price index", publisher: "Statistics Canada", url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810020501", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    money_history: { title: "Money Over Time history file: US M2, GDP, federal debt and Federal Reserve balance sheet (selected years)", publisher: "Macro Organizm, data/history.js (FRED M2SL, GDP and WALCL; Treasury Fiscal Data)", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Partial-year 2026 points are readings, not year-end values." },
    bis_tc: { title: "Total credit statistics (WS_TC)", publisher: "Bank for International Settlements", url: "https://data.bis.org/static/bulk/WS_TC_csv_flat.zip", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    bis_dsr: { title: "Debt service ratios (WS_DSR)", publisher: "Bank for International Settlements", url: "https://data.bis.org/static/bulk/WS_DSR_csv_flat.zip", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    imf_pfmh: { title: "Public Finances in Modern History Database (December 2025)", publisher: "International Monetary Fund, DataMapper", url: "https://www.imf.org/external/datamapper/api/v1/d", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    imf_weo: { title: "World Economic Outlook (October 2026): general government gross debt, % of GDP", publisher: "International Monetary Fund, DataMapper", url: "https://www.imf.org/external/datamapper/api/v1/GGXWDG_NGDP", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    imf_datamapper_weo: { title: "World Economic Outlook DataMapper: inflation (PCPIPCH) and real GDP growth (NGDP_RPCH), Venezuela and Zimbabwe", publisher: "International Monetary Fund", url: "https://www.imf.org/external/datamapper/api/v1/PCPIPCH/VEN", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "The API does not state the vintage; recent values are estimates or projections." },
    omb_hist: { title: "Historical Tables, FY2027 Budget (Tables 1.1, 3.1, 7.1 and 10.1)", publisher: "Office of Management and Budget", url: "https://www.whitehouse.gov/wp-content/uploads/2026/04/hist_fy2027.zip", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    treasury_hdo: { title: "Historical Debt Outstanding", publisher: "US Treasury, Fiscal Data", url: "https://fiscaldata.treasury.gov/datasets/historical-debt-outstanding/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    treasury_dttp: { title: "Debt to the Penny", publisher: "US Treasury, Fiscal Data", url: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    treasury_mts: { title: "Monthly Treasury Statement, Tables 4 and 9", publisher: "US Treasury, Fiscal Data", url: "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    treasury_avg_rates: { title: "Average Interest Rates on US Treasury Securities", publisher: "US Treasury, Fiscal Data", url: "https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fred_m2sl: { title: "M2 money stock (M2SL)", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/M2SL", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fred_currsl: { title: "Currency component of M1 (CURRSL)", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/CURRSL", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fred_h8: { title: "Commercial bank loans and leases (TOTLL) and deposits (DPSACBW027SBOG), H.8 release", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/TOTLL", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Ratios are research calculations." },
    fred_csushpinsa: { title: "S&P CoreLogic Case-Shiller US National Home Price Index (CSUSHPINSA)", publisher: "S&P Dow Jones Indices, via FRED", url: "https://fred.stlouisfed.org/series/CSUSHPINSA", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Not shipped with this site because of licence terms; figures are quoted." },
    fred_gs10: { title: "10-year Treasury constant maturity rate (GS10)", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/GS10", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fred_dfii10: { title: "10-year Treasury inflation-indexed security yield (DFII10)", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/DFII10", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fred_tnwbshno: { title: "Households and nonprofit organizations; net worth (TNWBSHNO)", publisher: "Federal Reserve Board, via FRED", url: "https://fred.stlouisfed.org/series/TNWBSHNO", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    fed_dfa: { title: "Distributional Financial Accounts", publisher: "Federal Reserve Board", url: "https://www.federalreserve.gov/releases/z1/dataviz/dfa/distribute/chart/", kind: "dataset", retrieved: "2026-10-24", checked: "data" },
    freddie_pmms: { title: "Primary Mortgage Market Survey", publisher: "Freddie Mac", url: "https://www.freddiemac.com/pmms", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Not shipped with this site because of licence terms; figures are quoted." },
    wdi_cpi_growth: { title: "World Development Indicators: CPI inflation (FP.CPI.TOTL.ZG) and real GDP growth (NY.GDP.MKTP.KD.ZG)", publisher: "World Bank", url: "https://api.worldbank.org/v2/country/USA/indicator/FP.CPI.TOTL.ZG", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Averages and standard deviations were computed by the research team (data updated 8 October 2026)." },
    wb_broad_money: { title: "Broad money (% of GDP), FM.LBL.BMNY.GD.ZS", publisher: "World Bank", url: "https://data.worldbank.org/indicator/FM.LBL.BMNY.GD.ZS", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Definitions differ across countries." },
    bis_spp: { title: "Residential property price statistics (nominal QGBN628BIS and real QGBR628BIS for the UK)", publisher: "Bank for International Settlements, via FRED", url: "https://fred.stlouisfed.org/series/QGBN628BIS", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "The Japan and Germany declines are reported secondhand and were not re-checked." },
    bitstamp_ohlc: { title: "BTC/USD daily OHLC", publisher: "Bitstamp", url: "https://www.bitstamp.net/api/v2/ohlc/btcusd/", kind: "dataset", retrieved: "2026-10-24", checked: "data", note: "Volatility and drawdowns were computed by the research team from daily closes." },
    fdic_rates: { title: "National Rates and Rate Caps (as of 19 October 2026)", publisher: "Federal Deposit Insurance Corporation", url: "https://www.fdic.gov/national-rates-and-rate-caps", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    fdic_90years: { title: "90 years of the FDIC", publisher: "Federal Deposit Insurance Corporation", url: "https://www.fdic.gov/90years", kind: "primary", checked: "cited" },
    ons_afford2025: { title: "Housing affordability in England and Wales: 2025", publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/peoplepopulationandcommunity/housing/bulletins/housingaffordabilityinenglandandwales/2025", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    boe2014: { title: "Money creation in the modern economy (McLeay, Radia and Thomas), Quarterly Bulletin 2014 Q1", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    bundesbank2017: { title: "The role of banks, non-banks and the central bank in the money creation process, Monthly Report April 2017", publisher: "Deutsche Bundesbank", url: "https://www.bundesbank.de/en/publications/reports/monthly-reports/monthly-report-april-2017-667334", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    jakab_kumhof: { title: "Banks are not intermediaries of loanable funds - and why this matters (Jakab and Kumhof), Staff Working Paper 529", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/working-paper/2015/banks-are-not-intermediaries-of-loanable-funds-and-why-this-matters", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    jst2017: { title: "Macrofinancial History and the New Business Cycle Facts (Jorda, Schularick and Taylor), NBER Working Paper 22743", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w22743", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    jst2013: { title: "When Credit Bites Back (Jorda, Schularick and Taylor), Journal of Money, Credit and Banking 2013", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w17621", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    schularick_taylor2012: { title: "Credit Booms Gone Bust (Schularick and Taylor), American Economic Review 102(2), 2012", publisher: "American Economic Association", url: "https://www.aeaweb.org/articles?id=10.1257/aer.102.2.1029", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    mian_sufi_verner2017: { title: "Household Debt and Business Cycles Worldwide (Mian, Sufi and Verner), Quarterly Journal of Economics 2017", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/digest/jan16/household-debt-and-business-cycles-worldwide", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    jknst2019: { title: "The Rate of Return on Everything, 1870-2015 (Jorda, Knoll, Kuvshinov, Schularick and Taylor), Quarterly Journal of Economics 2019", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w24112", kind: "primary", retrieved: "2026-10-24", checked: "abstract", note: "The bill and bond means are from the research briefs." },
    binswanger2009: { title: "Is there a growth imperative in capitalist economies? (Binswanger), Journal of Post Keynesian Economics 31(4), 2009", publisher: "Journal of Post Keynesian Economics", url: "https://ideas.repec.org/a/mes/postke/v31y2009i4p707-727.html", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    jackson_victor2015: { title: "Does credit create a growth imperative? (Jackson and Victor), Ecological Economics 120, 2015", publisher: "Ecological Economics", url: "https://ideas.repec.org/a/eee/ecolec/v120y2015icp32-48.html", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    cahen_fourot2016: { title: "Ecological monetary economics (Cahen-Fourot and Lavoie), Ecological Economics 126, 2016", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    selgin2024: { title: "Banks Are Intermediaries of Loanable Funds (Selgin), Cato Working Paper 80, 2024", publisher: "Cato Institute", url: "https://www.cato.org/sites/cato.org/files/2024-04/working-paper-80-updated-2.pdf", kind: "primary", checked: "cited", note: "The Cato site returned an access error during research; cited from the briefs." },
    fisher1933: { title: "The Debt-Deflation Theory of Great Depressions (Fisher), Econometrica 1933", kind: "primary", checked: "cited", note: "Background knowledge; not re-read." },
    benes_kumhof2012: { title: "The Chicago Plan Revisited (Benes and Kumhof), IMF Working Paper WP/12/202", publisher: "International Monetary Fund", url: "https://www.imf.org/en/publications/wp/issues/2016/12/31/the-chicago-plan-revisited-26178", kind: "primary", retrieved: "2026-10-24", checked: "abstract", note: "The IMF states that the views are the authors own." },
    fedhist_act: { title: "Federal Reserve Act Signed into Law", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/federal-reserve-act-signed", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    mccandless_weber1995: { title: "Some Monetary Facts (McCandless and Weber), Quarterly Review, Summer 1995", publisher: "Federal Reserve Bank of Minneapolis", url: "https://www.minneapolisfed.org/research/quarterly-review/some-monetary-facts", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    degrauwe_polan2005: { title: "Is Inflation Always and Everywhere a Monetary Phenomenon? (De Grauwe and Polan), Scandinavian Journal of Economics 107(2), 2005", publisher: "Scandinavian Journal of Economics", url: "https://ideas.repec.org/a/bla/scandj/v107y2005i2p239-259.html", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    sargent_surico2011: { title: "Two Illustrations of the Quantity Theory of Money (Sargent and Surico), American Economic Review 101(1), 2011", publisher: "American Economic Association", url: "https://ideas.repec.org/a/aea/aecrev/v101y2011i1p109-28.html", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    bernanke_blanchard2023: { title: "What Caused the US Pandemic-Era Inflation? (Bernanke and Blanchard), NBER Working Paper 31417", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w31417", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    jorda_liu2022: { title: "Why Is U.S. Inflation Higher than in Other Countries? (Jorda, Liu, Nechio and Rivera-Reyes), Economic Letter 2022-07", publisher: "Federal Reserve Bank of San Francisco", url: "https://www.frbsf.org/research-and-insights/publications/economic-letter/2022/03/why-is-us-inflation-higher-than-in-other-countries/", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    fed_inflation_goal: { title: "Why does the Federal Reserve aim for inflation of 2 percent over the longer run?", publisher: "Board of Governors of the Federal Reserve System", url: "https://www.federalreserve.gov/faqs/economy_14400.htm", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    fed_longer_run_goals: { title: "Statement on Longer-Run Goals and Monetary Policy Strategy (2025)", publisher: "Board of Governors of the Federal Reserve System", url: "https://www.federalreserve.gov/monetarypolicy/monetary-policy-strategy-tools-and-communications-statement-on-longer-run-goals-monetary-policy-strategy-2025.htm", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    fedhist_gold_ends: { title: "Gold Convertibility Ends", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/gold-convertibility-ends", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    fedhist_gold_reserve: { title: "Roosevelt's gold program and the Gold Reserve Act of 1934", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/gold-reserve-act", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    fedhist_great_depression: { title: "The Great Depression (Richardson)", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/great-depression", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    fedhist_great_inflation: { title: "The Great Inflation", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/great-inflation", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    fedhist_great_moderation: { title: "The Great Moderation", publisher: "Federal Reserve History (Board of Governors)", url: "https://www.federalreservehistory.org/essays/great-moderation", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    bordo_econlib: { title: "Gold Standard, Concise Encyclopedia of Economics (Bordo)", publisher: "Library of Economics and Liberty", url: "https://www.econlib.org/library/Enc/GoldStandard.html", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    basu_taylor1999: { title: "Business Cycles in International Historical Perspective (Basu and Taylor), NBER Working Paper 7090", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w7090", kind: "primary", retrieved: "2026-10-24", checked: "abstract", note: "Figures are from Table 1; the noisy pre-1913 data carry the caveats in the paper." },
    bordo_eichengreen1999: { title: "Is Our Current International Economic Environment Unusually Crisis Prone? (Bordo and Eichengreen)", publisher: "Reserve Bank of Australia conference volume", url: "https://rba.gov.au/publications/confs/1999/pdf/bordo-eichengreen.pdf", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    bordo2001: { title: "Is the crisis problem growing more severe? (Bordo, Eichengreen, Klingebiel and Martinez-Peria), Economic Policy 16(32), 2001", publisher: "Economic Policy", url: "https://ideas.repec.org/a/oup/ecpoli/v16y2001i32p52-82..html", kind: "primary", retrieved: "2026-10-24", checked: "abstract", note: "The tables could not be opened as text." },
    bordo_nber1999: { title: "Monetary Policy Regimes, the Gold Standard, and the Great Depression (Bordo), NBER Reporter, Fall 1999", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/reporter/fall-1999/monetary-policy-regimes-gold-standard-and-great-depression", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    bordo_lane_redish2004: { title: "Good versus Bad Deflation: Lessons from the Gold Standard Era (Bordo, Landon-Lane and Redish), NBER Working Paper 10329", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w10329", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    maddison_rba: { title: "Overview of long-run growth trends (Maddison 1993, as tabulated in RBA Research Discussion Paper 9507)", publisher: "Reserve Bank of Australia", url: "https://www.rba.gov.au/publications/rdp/1995/9507/overview-of-long-rim-growth-trends.html", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    bernanke_james1991: { title: "The Gold Standard, Deflation, and Financial Crisis in the Great Depression: An International Comparison (Bernanke and James), NBER Working Paper 3488", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w3488", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    eichengreen_sachs1985: { title: "Exchange Rates and Economic Recovery in the 1930s (Eichengreen and Sachs), Journal of Economic History 45(4), 1985", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w1498", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    stock_watson2002: { title: "Has the Business Cycle Changed and Why? (Stock and Watson), NBER Working Paper 9127", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w9127", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    ball_sheridan2003: { title: "Does Inflation Targeting Matter? (Ball and Sheridan), NBER Working Paper 9577", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w9577", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    roger2009: { title: "Inflation Targeting at 20: Achievements and Challenges (Roger), IMF Working Paper WP/09/236", publisher: "International Monetary Fund", url: "https://econpapers.repec.org/paper/imfimfwpa/2009_2f236.htm", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    obstfeld2013: { title: "Crises and the International System (Obstfeld), International Economic Journal 27(2), 2013, Table 1", publisher: "University of California, Berkeley", url: "https://eml.berkeley.edu/~obstfeld/Crises%20&%20the%20International%20System.pdf", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    laeven_valencia2018: { title: "Systemic Banking Crises Revisited (Laeven and Valencia), IMF Working Paper WP/18/206", publisher: "International Monetary Fund", url: "https://www.imf.org/en/publications/wp/issues/2018/09/14/systemic-banking-crises-revisited-46232", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    te_ara_rbnz: { title: "Reserve Bank (inflation targeting 1989/90), Te Ara Encyclopedia of New Zealand", publisher: "Te Ara", url: "https://teara.govt.nz/en/reserve-bank/page-3", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    hkma_milestones: { title: "Milestones of Monetary Reform", publisher: "Hong Kong Monetary Authority", url: "https://www.hkma.gov.hk/eng/key-functions/money/linked-exchange-rate-system/milestones-of-monetary-reform/", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    ec_bulgaria_euro: { title: "Bulgaria adopts the euro as of 1 January 2026", publisher: "European Commission", url: "https://trade.ec.europa.eu/access-to-markets/en/news/bulgaria-adopts-euro-1-january-2026", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    bta_bulgaria1997: { title: "July 1, 1997: Currency Board Takes Effect, Pegging Lev to Deutsche Mark", publisher: "Bulgarian Telegraph Agency", url: "https://www.bta.bg/en/news/921311-july-1-1997-currency-board-goes-into-effect-pegging-lev-to-deutsche-mark", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    ghosh1998: { title: "Currency Boards: The Ultimate Fix? (Ghosh, Gulde and Wolf), IMF Working Paper WP/98/8", publisher: "International Monetary Fund", url: "https://ideas.repec.org/p/imf/imfwpa/1998-008.html", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    ieo_argentina: { title: "The IMF and Argentina, 1991-2001", publisher: "IMF Independent Evaluation Office", url: "https://www.imf.org/external/np/ieo/2004/arg/eng/index.htm", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    sigurjonsson2015: { title: "Monetary Reform: A Better Monetary System for Iceland (Sigurjonsson), report to the Prime Minister of Iceland", publisher: "Government of Iceland", url: "https://www.stjornarradid.is/media/forsaetisraduneyti-media/media/skyrslur/monetary-reform.pdf", kind: "primary", retrieved: "2026-10-24", checked: "summary", note: "Conclusion read through a search summary." },
    bloomberg_swiss2018: { title: "Swiss Voters Reject Radical Sovereign Money Plan in Landslide, 10 June 2018", publisher: "Bloomberg", url: "https://www.bloomberg.com/politics/articles/2018-06-10/swiss-set-to-reject-sovereign-money-proposal-projection-shows", kind: "secondary", retrieved: "2026-10-24", checked: "summary", note: "Reports 75.7 percent no per the Swiss government." },
    niepelt2015: { title: "Sovereign Money in Iceland? (Niepelt), 11 April 2015", publisher: "Dirk Niepelt", url: "https://www.niepelt.ch/notes/sovereign-money-in-iceland/", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    bacchetta2017: { title: "Sovereign money reform in Switzerland would be a mistake (Bacchetta), VoxEU", publisher: "CEPR", url: "https://voxeu.org/article/monetary-reform-vollgeld-initiative-switzerland", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    tavlas2010: { title: "The Controversy over the Origins of the Chicago Plan for 100 Percent Reserves (Tavlas), Hoover Economics Working Paper 20102", publisher: "Hoover Institution", url: "https://www.hoover.org/sites/default/files/research/docs/20102-tavlas.pdf", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    hanke_krus2012: { title: "World Hyperinflations (Hanke and Krus), Cato Institute Working Paper 8, 2012", publisher: "Cato Institute", url: "https://www.cato.org/working-paper/world-hyperinflations", kind: "primary", retrieved: "2026-10-24", checked: "summary", note: "The page returned an access error; the 56 episodes and the 50 percent monthly threshold were confirmed from a search summary." },
    fischer_sahay_vegh2002: { title: "Modern Hyper- and High Inflations (Fischer, Sahay and Vegh), Journal of Economic Literature 40(3), 2002", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w8930", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    sargent1982: { title: "The Ends of Four Big Inflations (Sargent), Minneapolis Fed Working Paper 158", publisher: "Federal Reserve Bank of Minneapolis", url: "https://econpapers.repec.org/paper/fipfedmwp/158.htm", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    grubb2011: { title: "The Continental Dollar: Initial Design, Ideal Performance, and the Credibility of Congressional Commitment (Grubb), NBER Working Paper 17276", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w17276", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    majewski_war: { title: "Financing the War (Majewski), Americans at War", publisher: "Encyclopedia.com (Gale)", url: "https://www.encyclopedia.com/defense/energy-government-and-defense-magazines/financing-war", kind: "secondary", retrieved: "2026-10-24", checked: "summary", note: "Secondary source; to be replaced with a primary source." },
    wikipedia_greenbacks: { title: "Greenback (1860s money)", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Greenback_(1860s_money)", kind: "secondary", retrieved: "2026-10-24", checked: "summary", note: "Secondary source citing Mitchell (1903); to be replaced with a primary source." },
    weidenmier2002: { title: "Money and Finance in the Confederate States of America (Weidenmier), EH.Net Encyclopedia", publisher: "EH.Net", url: "https://eh.net/encyclopedia/money-and-finance-in-the-confederate-states-of-america/", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    hanke_kwok2009: { title: "On the Measurement of Zimbabwe's Hyperinflation (Hanke and Kwok), Cato Journal 29(2), 2009", publisher: "Cato Institute", url: "https://ideas.repec.org/a/cto/journl/v29y2009i2p353-364.html", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    olivo2023: { title: "Hyperinflation in Venezuela: An Analysis Based on Cagan's Conceptual Framework (Olivo), MPRA Paper 119195", publisher: "Munich Personal RePEc Archive", url: "https://mpra.ub.uni-muenchen.de/119195/", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    mankiw2020: { title: "A Skeptic's Guide to Modern Monetary Theory (Mankiw), AEA Papers and Proceedings 110; NBER Working Paper 26650", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w26650", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    igm_mmt2019: { title: "Modern Monetary Theory, survey of 13 March 2019", publisher: "IGM Forum, Kent A. Clark Center, University of Chicago Booth", url: "https://kentclarkcenter.org/surveys/modern-monetary-theory/", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    japan_mof2024: { title: "Debt Management Report 2024", publisher: "Japan Ministry of Finance", url: "https://www.mof.go.jp/english/policy/jgbs/publication/debt_management_report/2024/esaimu2024-1-3.pdf", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    bitcoin_wiki_supply: { title: "Controlled supply", publisher: "Bitcoin Wiki", url: "https://en.bitcoin.it/wiki/Controlled_supply", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    nakamoto2008: { title: "Bitcoin: A Peer-to-Peer Electronic Cash System (Nakamoto)", publisher: "bitcoin.org", url: "https://bitcoin.org/bitcoin.pdf", kind: "primary", checked: "cited" },
    alvarez2022: { title: "Are Cryptocurrencies Currencies? Bitcoin as Legal Tender in El Salvador (Alvarez, Argente and Van Patten), NBER Working Paper 29968", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w29968", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    imf_pr26316: { title: "IMF Executive Board Concludes the Second and Third Reviews Under the Extended Fund Facility for El Salvador, Press Release PR26316, 1 October 2026", publisher: "International Monetary Fund", url: "https://www.imf.org/en/news/articles/2026/10/01/pr26316-el-salvador-imf-concludes-2nd-and-3rd-reviews-under-the-eff", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    gfmag_elsalvador: { title: "El Salvador Alters Bitcoin Policy (Wirtz), 1 March 2025", publisher: "Global Finance", url: "https://gfmag.com/economics-policy-regulation/el-salvador-drops-bitcoin-legal-tender/", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    centralbanking_car: { title: "CAR to drop crypto as legal tender", publisher: "Central Banking", url: "https://www.centralbanking.com/central-banks/currency/digital-currencies/7956294/car-to-drop-crypto-as-legal-tender", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    knoll2017: { title: "No Price Like Home: Global House Prices, 1870-2012 (Knoll, Schularick and Steger), American Economic Review 107(2), 2017; Dallas Fed Working Paper 208", publisher: "Federal Reserve Bank of Dallas", url: "https://www.dallasfed.org/-/media/documents/institute/wpapers/2014/0208.pdf", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    glaeser_gyourko2018: { title: "The Economic Implications of Housing Supply (Glaeser and Gyourko), Journal of Economic Perspectives 32(1), 2018", publisher: "National Bureau of Economic Research", url: "https://www.nber.org/papers/w23833", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    rachel_smith2015: { title: "Secular drivers of the global real interest rate (Rachel and Smith), Staff Working Paper 571", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/working-paper/2015/secular-drivers-of-the-global-real-interest-rate", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    favara_imbs2015: { title: "Credit Supply and the Price of Housing (Favara and Imbs), American Economic Review 105(3), 2015", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    mian_sufi2011: { title: "House Prices, Home Equity-Based Borrowing, and the US Household Leverage Crisis (Mian and Sufi), American Economic Review 101(5), 2011", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    doepke_schneider2006: { title: "Inflation and the Redistribution of Nominal Wealth (Doepke and Schneider), Journal of Political Economy 114(6), 2006", publisher: "Journal of Political Economy", url: "https://ideas.repec.org/a/ucp/jpolec/v114y2006i6p1069-1097.html", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    reinhart_sbrancia2015: { title: "The Liquidation of Government Debt (Reinhart and Sbrancia), Economic Policy 30(82), 2015", publisher: "Peterson Institute for International Economics", url: "https://www.piie.com/publications/working-papers/liquidation-government-debt", kind: "primary", retrieved: "2026-10-24", checked: "summary", note: "Figures differ across versions of the paper." },
    boe2012_qe: { title: "The distributional effects of asset purchases, Quarterly Bulletin 2012 Q3", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/quarterly-bulletin/2012/q3/the-distributional-effects-of-asset-purchases", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    coibion2017: { title: "Innocent Bystanders? Monetary policy and inequality (Coibion, Gorodnichenko, Kueng and Silvia), Journal of Monetary Economics 2017", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    lenza_slacalek2018: { title: "How Does Monetary Policy Affect Income and Wealth Inequality? Evidence from Quantitative Easing in the Euro Area (Lenza and Slacalek), ECB Working Paper 2190, 2018", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    blanchard2019: { title: "Public Debt and Low Interest Rates (Blanchard), American Economic Review 109(4), 2019", publisher: "American Economic Association", url: "https://www.aeaweb.org/articles?id=10.1257/aer.109.4.1197", kind: "primary", retrieved: "2026-10-24", checked: "abstract" },
    herndon_ash_pollin2014: { title: "Does High Public Debt Consistently Stifle Economic Growth? A Critique of Reinhart and Rogoff (Herndon, Ash and Pollin), Cambridge Journal of Economics 38(2), 2014", publisher: "Cambridge Journal of Economics", url: "https://doi.org/10.1093/cje/bet075", kind: "primary", retrieved: "2026-10-24", checked: "full", note: "The text was read. The recalculated average growth is 2.2 percent a year above 90 percent debt, against 4.2, 3.1 and 3.2 percent in the bands below 30, 30 to 60 and 60 to 90 percent; Reinhart and Rogoff had reported -0.1 percent for the top band." },
    gorton_ordonez2020: { title: "Good Booms, Bad Booms (Gorton and Ordonez), Journal of the European Economic Association 2020", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read." },
    noss_sowerbutts2012: { title: "The implicit subsidy of banks (Noss and Sowerbutts), Financial Stability Paper 15", publisher: "Bank of England", url: "https://www.bankofengland.co.uk/-/media/boe/files/financial-stability-paper/2012/the-implicit-subsidy-of-banks.pdf", kind: "primary", retrieved: "2026-10-24", checked: "summary" },
    imf_global_debt2025: { title: "Global debt remains above 235% of world GDP (Gaspar, Goncalves and Poplawski-Ribeiro), 17 September 2025", publisher: "International Monetary Fund", url: "https://www.imf.org/en/blogs/articles/2025/09/17/global-debt-remains-above-235-of-world-gdp", kind: "primary", retrieved: "2026-10-24", checked: "full" },
    imf_fiscal_monitor_2026: { title: "Fiscal Monitor, April 2026", publisher: "International Monetary Fund", url: "https://www.imf.org/en/publications/fm/issues/2026/04/15/fiscal-monitor-april-2026", kind: "primary", checked: "cited", note: "Cited in the research briefs; not re-read. The figures quoted are projections." },
    cbo_via_hbc: { title: "The Budget and Economic Outlook: 2026 to 2036 (CBO, February 2026), as summarised by House Budget Committee staff", publisher: "House Budget Committee", url: "https://budget.house.gov/imo/media/doc/cbo_baseline_february_2026.pdf", kind: "secondary", retrieved: "2026-10-24", checked: "summary", note: "Secondhand: the CBO site returned an access error. The figures quoted are projections." },
    aaf_cbo_fy2026: { title: "CBO: FY 2026 budget deficit totaled $2 trillion, 8 October 2026", publisher: "American Action Forum", url: "https://www.americanactionforum.org/press-release/cbo-fy-2026-budget-deficit-totaled-2-trillion/", kind: "secondary", retrieved: "2026-10-24", checked: "summary" },
    friedman_schwartz1963: { title: "A Monetary History of the United States, 1867-1960 (Friedman and Schwartz), Princeton University Press, 1963", publisher: "Princeton University Press", kind: "primary", checked: "cited", note: "Background knowledge; not re-read for this page." },
    rothbard1963: { title: "America's Great Depression (Rothbard), Van Nostrand, 1963", publisher: "Ludwig von Mises Institute", kind: "primary", checked: "cited", note: "The Austrian account; named, not re-read for this page." },
    blanchard_dell_ariccia_mauro2010: { title: "Rethinking Macroeconomic Policy (Blanchard, Dell'Ariccia and Mauro), IMF Staff Position Note SPN/10/03, 2010", publisher: "International Monetary Fund", kind: "primary", checked: "cited", note: "Named as the argument for a higher inflation goal; not re-read for this page." },
    feldstein1997: { title: "The Costs and Benefits of Going from Low Inflation to Price Stability (Feldstein), in Romer and Romer (eds.), Reducing Inflation, University of Chicago Press for the NBER, 1997", publisher: "National Bureau of Economic Research", kind: "primary", checked: "cited", note: "Named as the argument for price stability; not re-read for this page." },
    jaravel2019: { title: "The Unequal Gains from Product Innovations: Evidence from the U.S. Retail Sector (Jaravel), Quarterly Journal of Economics 134(2), 2019", publisher: "Quarterly Journal of Economics", url: "https://researchonline.lse.ac.uk/id/eprint/105641", kind: "primary", checked: "cited", note: "Named in the research briefs; not re-read for this page." },
    minsky1992: { title: "The Financial Instability Hypothesis (Minsky), Levy Economics Institute Working Paper 74, 1992", publisher: "Levy Economics Institute", url: "https://www.levyinstitute.org/pubs/wp74.pdf", kind: "primary", checked: "cited", note: "Named as the source of the financial instability hypothesis; not re-read for this page." },
    calomiris_haber2014: { title: "Fragile by Design: The Political Origins of Banking Crises and Scarce Credit (Calomiris and Haber), Princeton University Press, 2014", publisher: "Princeton University Press", kind: "primary", checked: "cited", note: "Background knowledge; not re-read for this page." },
    selgin_white1994: { title: "How Would the Invisible Hand Handle Money? (Selgin and White), Journal of Economic Literature 32(4), 1994", publisher: "Journal of Economic Literature", kind: "primary", checked: "cited", note: "Background knowledge; not re-read for this page." },
    wray2015: { title: "Modern Money Theory: A Primer on Macroeconomics for Sovereign Monetary Systems (Wray), 2nd edition, Palgrave Macmillan, 2015", publisher: "Palgrave Macmillan", kind: "primary", checked: "cited", note: "A proponent's own statement of the position; named, not re-read for this page." },
    kelton2020: { title: "The Deficit Myth: Modern Monetary Theory and the Birth of the People's Economy (Kelton), PublicAffairs, 2020", publisher: "PublicAffairs", kind: "primary", checked: "cited", note: "A proponent's own statement of the position; named, not re-read for this page." },
    jackson_dyson2013: { title: "Modernising Money: Why Our Monetary System Is Broken and How It Can Be Fixed (Jackson and Dyson), Positive Money, 2013", publisher: "Positive Money", kind: "primary", checked: "cited", note: "The proponents' own statement of the sovereign-money design; named, not re-read for this page." }
  }
};
