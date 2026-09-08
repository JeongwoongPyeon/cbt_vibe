type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

export const ui = {
  filters: {
    trigger: "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-left text-sm hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50",
    label: "min-w-0 flex-1 break-words",
    popup: "z-50 w-[min(360px,calc(100vw_-_32px))] overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg",
    input: "w-full border-b border-hairline bg-transparent p-3 text-sm outline-none",
    list: "max-h-72 overflow-y-auto p-1",
    item: "flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
    empty: "p-4 text-sm text-ink-muted",
    segments: "flex flex-wrap gap-1 rounded-lg border border-hairline p-1",
    segment: "min-h-8 rounded px-3 py-1 text-sm text-ink-muted hover:bg-canvas-soft disabled:opacity-50",
    active: "bg-primary/10 font-semibold text-primary",
    chartGrid: "col-span-full grid min-w-0 grid-cols-2 gap-6 border-y border-hairline py-5 max-[800px]:grid-cols-1",
    chart: "relative h-64 min-w-0",
    section: "flex min-w-0 flex-col gap-3",
    full: "col-span-full min-w-0",
    table: "w-full text-left text-sm [&_th]:p-2 [&_td]:p-2 [&_tr]:border-b [&_tr]:border-hairline",
  },
  study: {
    workspace: "flex min-w-0 flex-col gap-4",
    toolbar: "flex flex-wrap items-end gap-3 border-b border-hairline pb-4",
    filter: "flex min-w-0 flex-1 basis-36 flex-col gap-1.5",
    body: "grid min-w-0 grid-cols-[minmax(0,1fr)_320px] gap-5 max-[1100px]:grid-cols-1",
    main: "min-w-0 bg-surface p-5 max-[680px]:p-3",
    aside: "flex min-w-0 flex-col gap-3 border-l border-hairline pl-4 max-[1100px]:border-l-0 max-[1100px]:border-t max-[1100px]:pl-0 max-[1100px]:pt-4",
    row: "flex flex-wrap items-center justify-between gap-3",
    actions: "flex flex-wrap items-center gap-2",
    navigation: "mt-5 flex items-center justify-between gap-2 border-t border-hairline pt-4",
    counter: "min-w-20 text-center text-sm tabular-nums text-ink-muted",
    heading: "m-0 text-lg font-semibold leading-normal",
    question: "my-5 whitespace-pre-wrap break-words text-xl font-semibold leading-relaxed",
    list: "flex max-h-[560px] flex-col gap-2 overflow-auto",
    meta: "my-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted",
    history: "inline-flex shrink-0 items-center gap-1",
    historySlot: "inline-flex size-6 shrink-0 items-center justify-center rounded border text-xs font-semibold",
    correct: "border-accent-green/30 bg-accent-green/10 text-accent-green",
    incorrect: "border-danger/30 bg-danger-soft text-danger",
    pending: "border-hairline bg-surface text-ink-faint",
    solved: "text-xs font-semibold text-primary",
    unsolved: "text-xs text-ink-muted",
    related: "mt-6 border-t border-hairline pt-4",
    relatedItem: "flex w-full flex-col gap-2 border-b border-hairline py-3 text-left hover:bg-canvas-soft",
    setup: "flex flex-wrap items-end gap-4 border-y border-hairline py-5",
    number: "flex w-32 flex-col gap-2",
    timer: "inline-flex min-w-24 items-center gap-2 font-semibold tabular-nums",
    numberGrid: "grid grid-cols-5 gap-2",
    numberButton: "relative flex h-10 min-w-0 items-center justify-center rounded border text-sm tabular-nums",
    numberActive: "ring-2 ring-primary ring-offset-1",
    numberAnswered: "border-primary/40 bg-primary/10 text-primary",
    flag: "absolute right-0.5 top-0.5 text-accent-orange",
    flagged: "text-accent-orange",
    result: "flex flex-wrap items-center gap-5 border-y border-hairline py-4",
    score: "text-2xl font-bold tabular-nums",
    error: "rounded border border-danger/30 bg-danger-soft p-3 text-sm text-danger",
    dialog: "m-auto w-[min(420px,calc(100%_-_32px))] rounded-lg border border-hairline bg-surface p-5 text-ink shadow-soft backdrop:bg-black/35",
    explanation: "mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed",
  },
  icon: {
    spin: "animate-spin",
  },
  layout: {
    loading: "flex min-h-screen items-center justify-center gap-3 text-ink-secondary",
    app: "grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-[1100px]:grid-cols-1",
    sidebar: "flex flex-col gap-6 border-r border-hairline bg-surface p-[18px_14px] max-[1100px]:sticky max-[1100px]:top-0 max-[1100px]:z-10 max-[1100px]:border-b max-[1100px]:border-r-0",
    content: "flex min-w-0 flex-col gap-[18px] p-[18px] max-[680px]:p-3",
    header: "flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-stretch",
    toolbar: "flex items-center gap-2 max-[680px]:w-full",
    panelGrid: "grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1100px]:grid-cols-1",
    dashboardGrid: "grid gap-4 grid-cols-[1.2fr_0.8fr] max-[1100px]:grid-cols-1",
    metricGrid: "grid grid-cols-2 gap-3 max-[680px]:grid-cols-1",
    fieldGrid: "mb-3 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1",
    criteriaGrid: "col-span-2 grid grid-cols-3 gap-3 rounded-lg border border-hairline bg-canvas-soft p-3 max-[680px]:col-span-1 max-[680px]:grid-cols-1",
    actionRow: "mt-4 flex items-center gap-2",
    actionSummary: "mt-4 flex items-center justify-between gap-2",
    badgeGroup: "flex flex-wrap gap-1.5",
    tabBar: "inline-flex self-start rounded-lg border border-hairline bg-canvas-soft p-1",
    stack: "flex flex-col",
    aiStack: "flex flex-col gap-4",
  },
  brand: {
    row: "flex items-center gap-3 px-2 py-1.5",
    mark: "flex size-[34px] items-center justify-center rounded-lg bg-ink text-[13px] font-bold text-on-primary",
    name: "block text-base leading-[1.3]",
    subtitle: "block text-xs leading-[1.33] text-ink-muted",
  },
  nav: {
    list: "flex flex-col gap-1 max-[1100px]:grid max-[1100px]:grid-cols-3 max-[680px]:grid-cols-2",
    item: "relative flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border-0 px-3 py-2.5 text-left",
    active: "bg-canvas-soft font-semibold text-ink before:absolute before:left-1 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary",
    inactive: "bg-transparent text-ink-secondary hover:bg-canvas-soft",
  },
  provider: {
    card: "mt-auto rounded-lg border border-hairline p-2.5 max-[1100px]:hidden",
    row: "grid min-h-7 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[13px] text-ink-muted",
    on: "text-[11px] text-accent-green",
    off: "text-[11px] text-ink-faint",
  },
  panel: {
    surface: "min-w-0 rounded-lg border border-hairline bg-surface p-5",
    tall: "min-h-[calc(100vh-120px)] min-w-0 rounded-lg border border-hairline bg-surface p-5 max-[1100px]:min-h-0",
    practice: "min-h-[calc(100vh-120px)] min-w-0 rounded-lg border border-hairline bg-surface p-5 max-[1100px]:min-h-0",
    practiceList: "max-h-[calc(100vh-120px)] min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface p-5 max-[1100px]:max-h-none",
    darkCallout: "flex items-center justify-between rounded-lg border border-transparent bg-secondary p-5 text-on-primary max-[680px]:flex-col max-[680px]:items-stretch",
  },
  section: {
    header: "mb-3.5 flex items-center justify-between",
    headerContent: "flex items-center gap-2",
    title: "m-0 text-lg leading-[1.33]",
    eyebrow: "m-0 text-xs font-semibold leading-[1.33] text-primary",
    darkEyebrow: "m-0 text-xs font-semibold leading-[1.33] text-on-primary",
    pageTitle: "m-0 text-[26px] leading-[1.23]",
    calloutTitle: "m-0 mt-1.5 max-w-[520px] text-[26px] leading-[1.23]",
    questionTitle: "m-[28px_0] text-2xl leading-[1.45]",
  },
  button: {
    primary: "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active",
    secondary: "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-ink",
    icon: "inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface",
    smallIcon: "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink",
    close: "inline-flex items-center border-0 bg-transparent",
    tab: "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm",
    tabActive: "bg-surface font-semibold text-ink shadow-sm",
    tabInactive: "text-ink-muted",
    listItem: "block w-full rounded-lg border border-transparent bg-transparent p-2.5 text-left text-ink hover:border-hairline hover:bg-canvas-soft",
  },
  field: {
    group: "flex flex-col gap-1.5",
    groupWithMargin: "mb-3 flex flex-col gap-1.5",
    resultGroup: "mt-2.5 flex flex-col gap-1.5",
    label: "text-[13px] text-ink-muted",
    input: "min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]",
    select: "min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]",
    textarea: "min-h-[104px] w-full resize-y rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]",
    previewStem: "my-2.5 min-h-[82px] w-full resize-y rounded border border-hairline bg-surface px-2 py-1.5 text-[17px] leading-[1.45] text-ink outline-none focus:border-primary",
    previewChoice: "min-h-[34px] w-full rounded border border-hairline bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-primary",
    previewAnswer: "min-h-[36px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-primary",
    wrongMemo: "min-h-[74px] w-full resize-y rounded border border-hairline p-2",
    searchShell: "flex min-h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-3 focus-within:border-primary focus-within:shadow-[rgba(0,117,222,0.14)_0_0_0_3px] max-[680px]:flex-1",
    searchInput: "min-w-[210px] border-0 bg-transparent outline-none max-[680px]:min-w-0 max-[680px]:w-full",
    examShell: "flex min-h-10 items-center rounded-full border border-hairline bg-surface px-3 max-[680px]:flex-1",
    examSelect: "min-w-[132px] border-0 bg-transparent text-sm font-semibold text-ink outline-none max-[680px]:w-full",
    answer: "min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]",
  },
  list: {
    answerChoices: "grid gap-2.5",
    row: "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-t border-hairline py-2.5 max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-1.5",
    statRow: "grid min-h-12 grid-cols-[minmax(90px,0.45fr)_1fr_auto] items-center gap-3 border-t border-hairline",
    noteRow: "grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-hairline py-4 max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch",
    previewRow: "grid min-h-[52px] grid-cols-[46px_92px_minmax(0,1fr)_minmax(120px,0.4fr)] items-center gap-3 border-t border-hairline max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-1.5",
    fileRow: "flex items-center justify-between gap-2",
    resultItem: "block border-t border-hairline py-4",
    questionMeta: "mb-1 block text-xs text-ink-muted",
    questionTitle: "line-clamp-2 block text-sm font-medium leading-[1.38]",
    resultTitle: "my-2.5 text-[17px] leading-[1.45]",
    choices: "my-2.5 flex flex-col gap-1.5 pl-[22px]",
    simpleChoices: "my-2.5 pl-[22px]",
    dividerStack: "flex max-h-[calc(100vh-180px)] flex-col gap-1.5 overflow-auto",
    answerLabel: "flex flex-col gap-2",
    resultPanel: "flex max-h-[calc(100vh-220px)] flex-col gap-1.5 overflow-auto",
  },
  text: {
    sm: "text-sm",
    block: "block",
    muted13: "text-[13px] text-ink-muted",
    secondary: "text-sm text-ink-secondary",
    body15: "text-[15px] leading-[1.5]",
    nowrap: "overflow-hidden text-ellipsis whitespace-nowrap",
    question: "font-medium leading-[1.45]",
    listQuestion: "overflow-hidden text-ellipsis whitespace-nowrap text-sm",
    fileName: "overflow-hidden text-ellipsis whitespace-nowrap",
    validationError: "mt-2 text-[13px] text-danger",
    confidence: "mt-2 text-[12px] text-ink-muted",
    answer: "block text-[15px] leading-[1.5]",
  },
  accessibility: {
    srOnly: "sr-only",
  },
  badge: "inline-flex rounded-full bg-canvas-soft px-2 py-1 text-xs font-semibold leading-[1.33] text-ink-secondary",
  status: "flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink-secondary shadow-soft",
  upload: "relative flex min-h-[118px] items-center justify-center gap-2.5 rounded-xl border border-dashed border-ink-faint bg-canvas-soft text-ink-secondary",
  uploadClickable: "relative mb-3 flex min-h-[118px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed border-ink-faint bg-canvas-soft text-ink-secondary",
  uploadInput: "absolute inset-0 cursor-pointer opacity-0",
  criteria: "mb-3 flex flex-col gap-1.5 rounded-lg border border-hairline bg-canvas-soft p-3 text-sm",
  progressTrack: "h-2 overflow-hidden rounded-full bg-canvas-soft",
  progressBar: "block h-full bg-primary",
  metric: "min-h-[94px] rounded-lg border border-hairline bg-surface p-[18px]",
  metricValue: "mt-2.5 block text-3xl leading-[1.2]",
  emptyLine: "flex min-h-[52px] items-center border-t border-hairline text-sm text-ink-muted",
  feedback: {
    correct: "mt-[18px] rounded-lg border border-[rgba(26,174,57,0.24)] bg-[#effaf1] p-3.5",
    incorrect: "mt-[18px] rounded-lg border border-[rgba(217,45,32,0.22)] bg-danger-soft p-3.5",
  },
  answerChoice: {
    base: "grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 text-left text-ink",
    idle: "border-hairline bg-surface hover:border-primary",
    selected: "border-primary bg-surface shadow-[rgba(0,117,222,0.16)_0_0_0_3px]",
    marker: "flex size-8 items-center justify-center rounded-full bg-canvas-soft font-semibold",
  },
} as const;

export function navItem(active: boolean): string {
  return cn(ui.nav.item, active ? ui.nav.active : ui.nav.inactive);
}

export function questionListItem(active: boolean): string {
  return active
    ? "block w-full rounded-lg border border-hairline bg-canvas-soft p-2.5 text-left text-ink"
    : ui.button.listItem;
}

export function providerStatus(configured: boolean): string {
  return configured ? ui.provider.on : ui.provider.off;
}

export function answerChoice(selected: boolean): string {
  return cn(ui.answerChoice.base, selected ? ui.answerChoice.selected : ui.answerChoice.idle);
}

export function feedbackBanner(correct: boolean): string {
  return correct ? ui.feedback.correct : ui.feedback.incorrect;
}

export function tabButton(active: boolean): string {
  return cn(ui.button.tab, active ? ui.button.tabActive : ui.button.tabInactive);
}

export function validationStatus(hasErrors: boolean): string {
  return hasErrors ? "text-[13px] not-italic text-danger" : "text-[13px] not-italic text-ink-muted";
}
