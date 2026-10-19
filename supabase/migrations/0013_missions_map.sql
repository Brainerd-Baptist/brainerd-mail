-- Missions hub: the world map of Brainerd's engagement.
-- One row per country. Edited in Brainerd Mail (Missions), shown live on the public website
-- (embed + JSON) and as an image block in emails. Only the server (service role) reads and writes.
create table public.missions_countries (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  name text not null,
  level smallint not null check (level between 1 and 3),
  since text not null default '',
  religion text not null default '',
  people_group text not null default '',
  unreached_groups text not null default '',
  unreached_pop text not null default '',
  -- Privacy switches: 'is_public' puts the country on the public map and in emails at all;
  -- 'show_people_group' controls whether the people-group names are shown with it.
  is_public boolean not null default true,
  show_people_group boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- What each level means, in the missions team's own words (shown as the map legend).
create table public.missions_levels (
  level smallint primary key check (level between 1 and 3),
  label text not null,
  blurb text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.missions_countries enable row level security;
alter table public.missions_levels enable row level security;
revoke all on public.missions_countries, public.missions_levels from anon, authenticated;
grant select, insert, update, delete on public.missions_countries, public.missions_levels to service_role;

insert into public.missions_levels (level, label, blurb) values (1,'Level 1',''),(2,'Level 2',''),(3,'Level 3','');

-- Starting data: copied from the map on brainerdbaptist.org/missions (47 countries).
insert into public.missions_countries (iso2,name,level,since,religion,people_group,unreached_groups,unreached_pop) values
  ('AF','Afghanistan',3,'2008','Islam','Ordo','37','41.4 Million'),
  ('AL','Albania',3,'2008','Orthodox','Roma','6','2.9 Million'),
  ('BT','Bhutan',1,'2017','Buddhism','Momo','30','629,000'),
  ('BH','Bahrain',1,'2019','Islam','Palm','12','1.5 Million'),
  ('KH','Cambodia',2,'2001','Buddhism','Khmer','19','16.4 Million'),
  ('CA','Canada',2,'2020','Secular','','87','11.3 Million'),
  ('TD','Chad',1,'2021','Islam','Desert','111','11 Million'),
  ('CN','China',2,'2005','Chinese Folk Religion','','332','150.4 Million'),
  ('CD','Congo DR',2,'2005','Animism','','163','40.2 Million'),
  ('EC','Ecuador',1,'2001','Catholic','Quichua','10','1.9 Million'),
  ('EG','Egypt',2,'2013','Islam','','23','111.6 Million'),
  ('FR','France',1,'2013','Islam','North Africans','64','60.7 Million'),
  ('GR','Greece',3,'2003','Orthodox','','12','10.5 Million'),
  ('HT','Haiti',3,'2008','Vodou','','3','108,000'),
  ('HK','Hong Kong',2,'2015','Chinese Folk Religion','','10','430,000'),
  ('IN','India',1,'1962','Hindu, Islam, Sikh','Kissan, Mysore','1,867','1.7 Billion'),
  ('ID','Indonesia',1,'2013','Islam','Coffee, Spice','162','219 Million'),
  ('IR','Iran',2,'2013','Islam','','45','84.9 Million'),
  ('IQ','Iraq',2,'2013','Islam','','24','44.7 Million'),
  ('IE','Ireland',3,'2018','Catholic','','7','5.1 Million'),
  ('IL','Israel',3,'2001','Jewish','','32','9.4 Million'),
  ('CI','Ivory Coast',3,'2016','Islam','','33','6.0 Million'),
  ('JM','Jamaica',3,'2011','Secular','','5','88,500'),
  ('JO','Jordan',1,'2015','Islam','Syrian Refugees, Bread People','15','11.5 Million'),
  ('LB','Lebanon',2,'2013','Islam','','12','5.2 Million'),
  ('LR','Liberia',2,'2013','Tribal','','13','1.8 Million'),
  ('ML','Mali',3,'2013','Islam','','38','22.5 Million'),
  ('MR','Mauritania',2,'2013','Islam','','10','4.8 Million'),
  ('MX','Mexico',3,'2013','Catholic','','37','2.4 Million'),
  ('NP','Nepal',1,'2013','Hindu','Momo','155','29.7 Million'),
  ('NL','Netherlands',2,'2011','Secular','','34','16.9 Million'),
  ('KP','North Korea',3,'2016','Atheism','','4','27.2 Million'),
  ('PK','Pakistan',3,'2011','Islam','','80','236.5 Million'),
  ('PA','Panama',1,'2015','Catholic, Tribal','Nationals','4','134,000'),
  ('PE','Peru',1,'2014','Catholic','Quichua','29','1.7 Million'),
  ('RO','Romania',2,'2008','Orthodox','','5','2.3 Million'),
  ('SK','Slovakia',2,'2022','Orthodox','','6','5.4 Million'),
  ('ZA','South Africa',1,'2021','Islam, Secular','Rooibos','18','16.4 Million'),
  ('SY','Syria',2,'2017','Islam','','21','21.3 Million'),
  ('TH','Thailand',2,'2023','Buddhism','','38','64.5 Million'),
  ('TG','Togo',1,'2022','Tribal','','28','4.6 Million'),
  ('TN','Tunisia',3,'2013','Islam','','11','12.2 Million'),
  ('TR','Turkey',2,'2013','Islam','','36','81.6 Million'),
  ('UG','Uganda',1,'2004','Islam, Tribal','Banyankole','49','46.4 Million'),
  ('UA','Ukraine',1,'2003','Orthodox','Russian Speakers','9','37.2 Million'),
  ('TZ','Tanzania',2,'2010','Islam','Ha','98','44.5 Million'),
  ('US','United States',1,'1928','Secular','Nationals, Refugees, Tempe, Eastern Europeans, Fort Bragg','186','21.2 Million');
