import type { CircuitObservationSnapshot } from '../domain/model.ts'
import { plain } from './labels.ts'

/** Current shared debt and page-local proof; never describes request history. */
export function circuitPresentation(row: CircuitObservationSnapshot): string {
  const prefix = `${row.kind === 'video' ? '影片' : '音訊'}共享熔斷 L${row.level}｜`
  if (row.phase === 'isolated')
    return prefix + `隔離中，截止 ${new Date(row.until).toLocaleString('zh-TW', { hour12: false })}`
  if (row.phase === 'clear') return prefix + '沒有熔斷等級'
  if (row.phase === 'observing')
    return (
      prefix +
      `本頁觀察 ${Math.floor(row.progressSec)}／300 秒；距滿期約 ${Math.ceil(row.remainingSec ?? 0)} 秒`
    )
  if (row.phase === 'settling')
    return (
      prefix +
      '本頁待結算：' +
      plain(row.reason, {
        'awaiting-end-success': '等待期末成功',
        'awaiting-pending-results': '等待本輪未決結果',
        committing: '等待儲存確認',
      }) +
      `；結算期限剩餘約 ${Math.ceil(row.remainingSec ?? 0)} 秒`
    )
  return (
    prefix +
    '等待本頁新實傳；' +
    plain(row.reason, {
      'awaiting-new-transfer': '尚無有效觀察',
      'awaiting-control-version': '等待合法更新建立控制版本',
      'success-gap-expired': '成功間隔已超過兩分鐘',
      'settlement-expired': '結算期限已過，證據不足',
      'no-common-lock': '降級暫停：無共同儲存鎖或同步能力不足',
      'storage-unconfirmed': '儲存結果未確認',
      unconfirmed: '儲存結果未確認',
      'clock-gap': '時間或排程中斷',
      'clock-invalid': '時間無效',
      'capacity-exceeded': '觀察容量不足',
      'playback-invalidated': '播放狀態已改變',
      'route-changed': '主機或表示已改變',
      'rate-changed': '倍率已改變',
      'policy-changed': '政策已改變',
      'content-changed': '內容已改變',
      'control-changed': '共享控制版本已改變',
      'failure-pending': '等待失敗提交',
      stale: '共享控制版本已改變',
      invalid: '觀察資格已失效',
      'downgrade-committed': '上一級觀察已完成',
    })
  )
}
