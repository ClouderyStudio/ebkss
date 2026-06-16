<template>
  <section class="graph-panel">
    <div ref="chartRef" class="graph-canvas" role="img" aria-label="知识图谱"></div>
  </section>
</template>

<script setup>
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

use([GraphChart, TooltipComponent, CanvasRenderer]);

const props = defineProps({
  graph: {
    type: Object,
    default: null
  },
  activeNodeId: {
    type: String,
    default: ''
  }
});

const chartRef = ref(null);
let chart;

function render() {
  if (!chartRef.value || !props.graph) {
    return;
  }

  if (!chart) {
    chart = init(chartRef.value);
  }

  chart.setOption({
    tooltip: {
      formatter: (params) => params.data?.description || params.data?.label || params.name
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: {
          repulsion: 220,
          edgeLength: 110
        },
        label: {
          show: true,
          fontSize: 13
        },
        edgeLabel: {
          show: true,
          formatter: '{c}',
          fontSize: 11
        },
        data: props.graph.nodes.map((node) => {
          const isActive = node.id === props.activeNodeId;
          return {
            id: node.id,
            name: node.name,
            description: node.description || node.meaning || node.name,
            symbolSize: isActive ? 72 : node.type === 'root' ? 62 : 52,
            itemStyle: {
              color: isActive ? '#f59e0b' : node.type === 'root' ? '#2563eb' : '#246b61',
              borderColor: isActive ? '#fff7ed' : '#dbe7e5',
              borderWidth: isActive ? 4 : 2
            },
            label: {
              color: isActive ? '#111827' : '#17202a',
              fontWeight: isActive ? 800 : 600
            }
          };
        }),
        links: props.graph.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          value: edge.label
        })),
        lineStyle: {
          color: '#6c7a89',
          width: 1.5
        }
      }
    ]
  });
}

onMounted(() => {
  render();
  window.addEventListener('resize', resize);
});

watch(() => props.graph, () => {
  render();
  focusActive();
}, { deep: true });

watch(() => props.activeNodeId, () => {
  render();
  focusActive();
});

function focusActive() {
  if (!chart || !props.activeNodeId) return;
  // ECharts 动画聚焦到当前节点
  chart.dispatchAction({
    type: 'focusNodeAdjacency',
    seriesIndex: 0,
    dataIndex: props.graph?.nodes?.findIndex(n => n.id === props.activeNodeId) ?? -1
  });
}

function resize() {
  chart?.resize();
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
});
</script>
