<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalendarOptions, DatesSetInfo, EventClickInfo } from '@fullcalendar/vue3'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/vue3/daygrid'
import listPlugin from '@fullcalendar/vue3/list'
import timeGridPlugin from '@fullcalendar/vue3/timegrid'
import zhCnLocale from '@fullcalendar/vue3/locales/zh-cn'
import classicTheme from '@fullcalendar/vue3/themes/classic'
import '@fullcalendar/vue3/skeleton.css'
import '@fullcalendar/vue3/themes/classic/theme.css'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { getCalendarEvents } from '@/api/calendar.api'
import { queryKeys } from '@/api/query-keys'
import CalendarEventDrawer from '@/components/calendar/CalendarEventDrawer.vue'
import CalendarToolbar from '@/components/calendar/CalendarToolbar.vue'
import AppErrorState from '@/components/common/AppErrorState.vue'
import AppPageHeader from '@/components/common/AppPageHeader.vue'
import { CALENDAR_DEFAULT_VIEW, type CalendarViewName } from '@/constants/calendar'
import {
  readEventProps,
  toCalendarEventInputs,
  type CalendarEventExtendedProps,
} from '@/utils/calendar'

interface CalendarHandle {
  next: () => void
  prev: () => void
  today: () => void
  changeView: (view: string) => void
}

const router = useRouter()

const calendarRef = ref<{ getApi: () => CalendarHandle } | null>(null)
const view = ref<CalendarViewName>(CALENDAR_DEFAULT_VIEW)
const title = ref('')
const range = ref<{ from: string; to: string } | null>(null)

const drawerVisible = ref(false)
const selectedEvent = ref<CalendarEventExtendedProps | null>(null)

const queryParams = computed(() => range.value ?? { from: '', to: '' })

const { data, isError, refetch } = useQuery({
  queryKey: computed(() => queryKeys.calendar(queryParams.value)),
  queryFn: () => getCalendarEvents({ from: queryParams.value.from, to: queryParams.value.to }),
  enabled: computed(() => range.value !== null),
})

const events = computed(() => toCalendarEventInputs(data.value ?? []))

function onDatesSet(info: DatesSetInfo): void {
  const from = info.startStr.slice(0, 10)
  const to = info.endStr.slice(0, 10)
  view.value = info.view.type as CalendarViewName
  title.value = info.view.title
  if (!range.value || range.value.from !== from || range.value.to !== to) {
    range.value = { from, to }
  }
}

function onEventClick(info: EventClickInfo): void {
  const props = readEventProps(info.event.extendedProps as Record<string, unknown>)
  if (!props) return
  selectedEvent.value = props
  drawerVisible.value = true
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, classicTheme],
  initialView: CALENDAR_DEFAULT_VIEW,
  headerToolbar: false,
  locale: zhCnLocale,
  firstDay: 1,
  height: 'auto',
  dayMaxEvents: 3,
  events: events.value,
  datesSet: onDatesSet,
  eventClick: onEventClick,
}))

function api(): CalendarHandle | undefined {
  return calendarRef.value?.getApi()
}

function changeView(next: CalendarViewName): void {
  view.value = next
  api()?.changeView(next)
}

function viewOrder(): void {
  if (!selectedEvent.value) return
  drawerVisible.value = false
  void router.push(`/orders/${selectedEvent.value.orderId}`)
}
</script>

<template>
  <div>
    <AppPageHeader title="日历" description="付款、出货与物流的时间轴" />

    <CalendarToolbar
      :view="view"
      :title="title"
      @update:view="changeView"
      @prev="api()?.prev()"
      @next="api()?.next()"
      @today="api()?.today()"
    />

    <AppErrorState v-if="isError" @retry="refetch" />

    <div class="calendar-page__surface app-card">
      <FullCalendar ref="calendarRef" :options="calendarOptions" />
    </div>

    <CalendarEventDrawer v-model="drawerVisible" :event-props="selectedEvent" @view-order="viewOrder" />
  </div>
</template>

<style scoped>
.calendar-page__surface {
  padding: 12px 16px 16px;
}
</style>
