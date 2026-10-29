export async function reminderStatus(api: Pick<typeof Notification, 'requestPermission'> | undefined): Promise<string> {
  if (!api) return '이 브라우저는 알림을 지원하지 않습니다. 일정은 저장되었습니다.';
  try {
    return await api.requestPermission() === 'granted'
      ? '알림은 이 앱을 연 상태에서만 시도됩니다. 백그라운드에서는 놓칠 수 있습니다.'
      : '알림 권한이 없어 알림을 보낼 수 없습니다. 일정은 저장되었습니다.';
  } catch {
    return '알림을 설정하지 못했습니다. 일정은 저장되었습니다.';
  }
}
