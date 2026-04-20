
  create table "public"."data_access_log" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "accessed_by" uuid,
    "resource_type" text,
    "resource_id" uuid,
    "access_type" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."data_access_log" enable row level security;

CREATE UNIQUE INDEX data_access_log_pkey ON public.data_access_log USING btree (id);

CREATE INDEX idx_data_access_log_accessed_by ON public.data_access_log USING btree (accessed_by);

CREATE INDEX idx_data_access_log_user_id ON public.data_access_log USING btree (user_id);

alter table "public"."data_access_log" add constraint "data_access_log_pkey" PRIMARY KEY using index "data_access_log_pkey";

alter table "public"."data_access_log" add constraint "data_access_log_accessed_by_fkey" FOREIGN KEY (accessed_by) REFERENCES auth.users(id) not valid;

alter table "public"."data_access_log" validate constraint "data_access_log_accessed_by_fkey";

alter table "public"."data_access_log" add constraint "data_access_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."data_access_log" validate constraint "data_access_log_user_id_fkey";

grant delete on table "public"."data_access_log" to "anon";

grant insert on table "public"."data_access_log" to "anon";

grant references on table "public"."data_access_log" to "anon";

grant select on table "public"."data_access_log" to "anon";

grant trigger on table "public"."data_access_log" to "anon";

grant truncate on table "public"."data_access_log" to "anon";

grant update on table "public"."data_access_log" to "anon";

grant delete on table "public"."data_access_log" to "authenticated";

grant insert on table "public"."data_access_log" to "authenticated";

grant references on table "public"."data_access_log" to "authenticated";

grant select on table "public"."data_access_log" to "authenticated";

grant trigger on table "public"."data_access_log" to "authenticated";

grant truncate on table "public"."data_access_log" to "authenticated";

grant update on table "public"."data_access_log" to "authenticated";

grant delete on table "public"."data_access_log" to "service_role";

grant insert on table "public"."data_access_log" to "service_role";

grant references on table "public"."data_access_log" to "service_role";

grant select on table "public"."data_access_log" to "service_role";

grant trigger on table "public"."data_access_log" to "service_role";

grant truncate on table "public"."data_access_log" to "service_role";

grant update on table "public"."data_access_log" to "service_role";


  create policy "users_read_own_access_log"
  on "public"."data_access_log"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



