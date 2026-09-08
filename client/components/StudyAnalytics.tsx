import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";
import type { AppState } from "@/lib/types";
import { learningMetrics } from "@/lib/analytics";
import { cn, ui } from "@/lib/ui-classes";

Chart.register(
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

function Plot({
  config,
  label,
}: {
  config: ChartConfiguration;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, config);
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) chart.update("none");
    });
    return () => {
      alive = false;
      chart.destroy();
    };
  }, [config]);
  return (
    <div className={ui.filters.chart}>
      <canvas ref={ref} role="img" aria-label={label}>
        {label}
      </canvas>
    </div>
  );
}

export default function StudyAnalytics({ state }: { state: AppState }) {
  const [days, setDays] = useState<7 | 30>(7);
  const metrics = useMemo(
    () => learningMetrics(state.attempts, state.questions, days),
    [state.attempts, state.questions, days],
  );
  const configs = useMemo(() => {
    const font = { family: '"Noto Sans KR", sans-serif', size: 12 };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { labels: { font } },
        tooltip: { bodyFont: font, titleFont: font },
      },
    };
    const percentScale = {
      min: 0,
      max: 100,
      ticks: { font, callback: (value: string | number) => `${value}%` },
    };
    return {
      ratio: {
        type: "doughnut",
        data: {
          labels: ["정답", "오답"],
          datasets: [
            {
              data: [metrics.correct, metrics.incorrect],
              backgroundColor: ["#2a9d99", "#d92d20"],
              borderWidth: 2,
            },
          ],
        },
        options,
      },
      trend: {
        type: "line",
        data: {
          labels: metrics.daily.map((day) => day.date.slice(5)),
          datasets: [
            {
              label: "정답률 (%)",
              data: metrics.daily.map((day) => day.accuracy),
              borderColor: "#0075de",
              backgroundColor: "#0075de",
              pointRadius: 4,
              spanGaps: false,
            },
          ],
        },
        options: {
          ...options,
          scales: { y: percentScale, x: { ticks: { font, maxTicksLimit: 7 } } },
        },
      },
      units: {
        type: "bar",
        data: {
          labels: metrics.units
            .slice(0, 8)
            .map((unit) =>
              unit.label.length > 22
                ? `${unit.label.slice(0, 22)}…`
                : unit.label,
            ),
          datasets: [
            {
              label: "단원 정답률 (%)",
              data: metrics.units.slice(0, 8).map((unit) => unit.accuracy),
              backgroundColor: "#2a9d99",
            },
          ],
        },
        options: {
          ...options,
          indexAxis: "y",
          scales: { x: percentScale, y: { ticks: { font } } },
          plugins: {
            ...options.plugins,
            tooltip: {
              ...options.plugins.tooltip,
              callbacks: {
                title: (items: { dataIndex: number }[]) =>
                  metrics.units[items[0]?.dataIndex]?.label || "",
              },
            },
          },
        },
      },
    } satisfies Record<string, ChartConfiguration>;
  }, [metrics]);
  return (
    <section className={ui.filters.chartGrid} aria-label="학습 통계">
      <div className={cn(ui.study.row, ui.filters.full)}>
        <div>
          <h2 className={ui.study.heading}>학습 통계</h2>
          <p className={ui.text.muted13}>
            최근 {days}일 · 한국 시간 · {metrics.total}회 풀이
          </p>
        </div>
        <div
          className={ui.filters.segments}
          role="group"
          aria-label="통계 기간"
        >
          {([7, 30] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={days === value}
              className={cn(
                ui.filters.segment,
                days === value && ui.filters.active,
              )}
              onClick={() => setDays(value)}
            >
              {value}일
            </button>
          ))}
        </div>
      </div>
      {!metrics.total ? (
        <p className={ui.filters.full}>선택한 기간의 풀이 기록이 없습니다.</p>
      ) : (
        <>
          <div className={ui.filters.section}>
            <h3 className={ui.study.heading}>정오답 비율</h3>
            <p className={ui.text.muted13}>
              정답 {metrics.correct}회 · 오답 {metrics.incorrect}회 · 정답률{" "}
              {metrics.accuracy}% · 오답률 {100 - (metrics.accuracy ?? 0)}%
            </p>
            <Plot
              config={configs.ratio}
              label={`정답 ${metrics.correct}회, 오답 ${metrics.incorrect}회`}
            />
          </div>
          <div className={ui.filters.section}>
            <h3 className={ui.study.heading}>일별 정답률</h3>
            <p className={ui.text.muted13}>풀이가 없는 날은 기록 없음</p>
            <Plot
              config={configs.trend}
              label="일별 정답률 추이. 아래 상세 기록에서 수치를 확인할 수 있습니다."
            />
          </div>
          <div className={ui.filters.section}>
            <h3 className={ui.study.heading}>단원별 성과</h3>
            <p className={ui.text.muted13}>풀이 횟수 상위 8개 단원</p>
            <Plot
              config={configs.units}
              label="단원별 정답률. 아래 상세 기록에서 전체 단원 수치를 확인할 수 있습니다."
            />
          </div>
          <details className={ui.filters.section}>
            <summary>상세 기록</summary>
            <table className={ui.filters.table}>
              <caption>단원별 풀이</caption>
              <thead>
                <tr>
                  <th scope="col">단원</th>
                  <th scope="col">풀이</th>
                  <th scope="col">정답률</th>
                </tr>
              </thead>
              <tbody>
                {metrics.units.map((unit) => (
                  <tr key={unit.key}>
                    <th scope="row">{unit.label}</th>
                    <td>{unit.total}</td>
                    <td>{unit.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className={ui.filters.table}>
              <caption>일별 풀이</caption>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">풀이</th>
                  <th scope="col">정답률</th>
                </tr>
              </thead>
              <tbody>
                {metrics.daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th>
                    <td>{day.total}</td>
                    <td>
                      {day.accuracy === null ? "기록 없음" : `${day.accuracy}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
