import type { massRename as en } from '../en/massRename'
import { pluralUk } from '../../plural'

export const massRename: typeof en = {
  title: (n) => `Масове перейменування · ${n} ${pluralUk(n, 'елемент', 'елементи', 'елементів')}`,
  willChange: (n) => `Зміниться ${n}`,
  noChanges: 'Немає змін',
  hasConflicts: 'є конфлікти',

  modeReplace: 'Знайти і замінити',
  modeTemplate: 'За шаблоном',

  find: 'Знайти',
  replaceWith: 'Замінити на',
  groupsHint: 'Групи доступні як $1, $2',
  regex: 'Регулярний вираз',
  ignoreCase: 'Без урахування регістру',
  lowercase: 'Усе в нижній регістр',

  template: 'Шаблон',
  templateHint: '{name} ім’я без розширення, {ext} розширення з крапкою, {n} номер, {date} дата зміни',
  start: 'Початок {n}',
  digits: 'Розрядів',

  problemEmpty: 'порожня назва',
  problemSlash: 'містить / або \\',
  problemDuplicate: 'дублікат у списку',
  problemExists: 'файл уже існує',

  partialFailure: 'Не все вдалося перейменувати',
  renamed: 'Перейменовано'
}
