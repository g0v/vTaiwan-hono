-- 名稱首次由使用者自行修改後，30 天內不得再修改。應用層預先檢查是為了
-- 回傳可辨識的錯誤碼；trigger 則是不可繞過、可處理併發請求的最終防線。
alter table "user" add column "nameChangedAt" date;

create trigger "user_name_change_cooldown"
before update of "name" on "user"
for each row
when new."name" is not old."name"
  and old."nameChangedAt" is not null
  and unixepoch('now') < unixepoch(old."nameChangedAt") + 2592000
begin
  select raise(abort, 'NAME_CHANGE_COOLDOWN');
end;

create trigger "user_record_name_change"
after update of "name" on "user"
for each row
when new."name" is not old."name"
begin
  update "user" set "nameChangedAt" = current_timestamp where "id" = new."id";
end;
