<template>
  <div id="app">
    <router-view />
    <div class="notification-list">
      <template v-for="(notification, index) in this.notifications">
        <notification :key="index" :notification="notification" />
      </template>
    </div>
    <component :is="this.modal" />
  </div>
</template>

<script lang="ts" src="App.ts"></script>

<style lang="scss">
.notification-list {
  position: absolute;
  z-index: 100;
  right: 10px;
  bottom: 10px;
}
</style>
