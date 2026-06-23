-- Stores the finished products selected for an ECR request.
alter table ecr_request add column if not exists finished_products varchar(5000);
