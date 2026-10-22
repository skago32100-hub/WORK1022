/**
 * charts.js
 * Chart.js 기반 인포그래픽 차트 렌더링 및 동적 업데이트 모듈
 */

const BudgetCharts = {
  instances: {
    categoryShare: null,
    categoryComparison: null,
    newProjectsRank: null,
    newVsExisting: null
  },

  // 모던 테마 색상 팔레트
  palette: [
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // purple-500
    '#06b6d4', // cyan-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#64748b'  // slate-500
  ],

  /**
   * 전체 차트 렌더링 및 갱신
   */
  updateAll(metrics, meta) {
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js 라이브러리가 로드되지 않았습니다.");
      return;
    }

    this.renderCategoryShareChart(metrics.categories, metrics.totalCurrYear, meta.unit);
    this.renderCategoryComparisonChart(metrics.categories, meta);
    this.renderNewVsExistingChart(metrics, meta.unit);
    this.renderNewProjectsRankChart(metrics.newProjects, meta.unit);
  },

  /**
   * 1. 분야별 예산 점유율 도넛 차트
   */
  renderCategoryShareChart(categories, totalBudget, unit) {
    const ctx = document.getElementById('categoryShareChart');
    if (!ctx) return;

    if (this.instances.categoryShare) {
      this.instances.categoryShare.destroy();
    }

    // 예산 상위 분야들
    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.currYearTotal);
    const backgroundColors = categories.map((_, i) => this.palette[i % this.palette.length]);

    // 도넛 중앙 텍스트 플러그인
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw(chart) {
        const { width, height, ctx } = chart;
        ctx.restore();
        const fontSize = Math.min(width, height) / 16;
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#64748b';

        const text1 = '총 예산';
        const text1X = Math.round((width - ctx.measureText(text1).width) / 2);
        const text1Y = height / 2 - (fontSize * 0.7);
        ctx.fillText(text1, text1X, text1Y);

        ctx.font = `bold ${fontSize * 1.3}px sans-serif`;
        ctx.fillStyle = '#1e293b';
        const formattedTotal = totalBudget >= 10000 
          ? (totalBudget / 10000).toFixed(1) + '조'
          : totalBudget.toLocaleString();
        const text2 = `${formattedTotal} ${unit}`;
        const text2X = Math.round((width - ctx.measureText(text2).width) / 2);
        const text2Y = height / 2 + (fontSize * 0.8);
        ctx.fillText(text2, text2X, text2Y);

        ctx.save();
      }
    };

    this.instances.categoryShare = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { size: 12, family: 'inherit' },
              padding: 12,
              generateLabels: (chart) => {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => {
                    const val = data.datasets[0].data[i];
                    const percent = totalBudget > 0 ? ((val / totalBudget) * 100).toFixed(1) : 0;
                    return {
                      text: `${label} (${percent}%)`,
                      fillStyle: data.datasets[0].backgroundColor[i],
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const percent = totalBudget > 0 ? ((val / totalBudget) * 100).toFixed(1) : 0;
                return ` ${val.toLocaleString()} ${unit} (${percent}%)`;
              }
            }
          }
        }
      },
      plugins: [centerTextPlugin]
    });
  },

  /**
   * 2. 분야별 전년 vs 당해연도 예산 비교 수평 막대 차트
   */
  renderCategoryComparisonChart(categories, meta) {
    const ctx = document.getElementById('categoryComparisonChart');
    if (!ctx) return;

    if (this.instances.categoryComparison) {
      this.instances.categoryComparison.destroy();
    }

    // 시각적 편의를 위해 순서 반전(가로 막대 상단이 1순위가 되도록)
    const reversed = [...categories].reverse();
    const labels = reversed.map(c => {
      // 분야명이 너무 길면 말줄임
      return c.category.length > 18 ? c.category.substring(0, 16) + '...' : c.category;
    });

    const prevData = reversed.map(c => c.prevYearTotal);
    const currData = reversed.map(c => c.currYearTotal);

    this.instances.categoryComparison = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: meta.prevYearLabel,
            data: prevData,
            backgroundColor: '#94a3b8',
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          },
          {
            label: meta.currYearLabel,
            data: currData,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 11 },
              callback: (val) => val.toLocaleString() + ' ' + meta.unit
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: '500' } }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { boxWidth: 14, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString()} ${meta.unit}`
            }
          }
        }
      }
    });
  },

  /**
   * 3. 신규사업 vs 계속사업 예산 비중 도넛 차트
   */
  renderNewVsExistingChart(metrics, unit) {
    const ctx = document.getElementById('newVsExistingChart');
    if (!ctx) return;

    if (this.instances.newVsExisting) {
      this.instances.newVsExisting.destroy();
    }

    const existingBudget = Math.max(0, metrics.totalCurrYear - metrics.newTotalBudget);
    const newBudget = metrics.newTotalBudget;

    this.instances.newVsExisting = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['계속 사업', '신규 사업'],
        datasets: [{
          data: [existingBudget, newBudget],
          backgroundColor: ['#3b82f6', '#8b5cf6'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 12, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const percent = metrics.totalCurrYear > 0 
                  ? ((val / metrics.totalCurrYear) * 100).toFixed(1) 
                  : 0;
                return ` ${context.label}: ${val.toLocaleString()} ${unit} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * 4. 신규사업 규모 Top 랭킹 수평 막대 차트
   */
  renderNewProjectsRankChart(newProjects, unit) {
    const ctx = document.getElementById('newProjectsChart');
    if (!ctx) return;

    if (this.instances.newProjectsRank) {
      this.instances.newProjectsRank.destroy();
    }

    if (!newProjects || newProjects.length === 0) {
      return;
    }

    // 상위 최대 7개
    const topProjects = [...newProjects].slice(0, 7).reverse();
    const labels = topProjects.map(p => {
      return p.name.length > 15 ? p.name.substring(0, 14) + '…' : p.name;
    });
    const data = topProjects.map(p => p.currYear);

    this.instances.newProjectsRank = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '신규 편성 예산',
          data,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          barPercentage: 0.65
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 11 },
              callback: (val) => val.toLocaleString() + ' ' + unit
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: '500' } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => topProjects[items[0].dataIndex].name,
              label: (ctx) => ` 신규 예산: ${ctx.raw.toLocaleString()} ${unit}`
            }
          }
        }
      }
    });
  }
};

if (typeof window !== 'undefined') {
  window.BudgetCharts = BudgetCharts;
}
