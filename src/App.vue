<template>
  <div class="page">
    <h1>Element Plus 日期 / 周 / 维度选择器 Demo</h1>
    <PeriodPickerDemo />
    <WeekPickerDemo />
  </div>
</template>

<script setup>
import PeriodPickerDemo from './components/PeriodPickerDemo.vue'
import WeekPickerDemo from './components/WeekPickerDemo.vue'
</script>

<style>
body {
  margin: 0;
  background: #fff;
  color: #303133;
}
.page {
  max-width: 820px;
  margin: 0 auto;
  padding: 16px 0 48px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.page > h1 {
  padding: 0 24px;
  font-size: 20px;
}
</style>
