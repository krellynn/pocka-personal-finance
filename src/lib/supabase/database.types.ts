
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: string,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "audit_logs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"budgets": {
                  Row: {
                    "category_id": string,"created_at": string,"currency": string,"period_month": string,"planned_amount": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"currency": string,"period_month": string,"planned_amount": number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"currency"?: string,"period_month"?: string,"planned_amount"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "budgets_workspace_id_category_id_fkey"
      columns: ["workspace_id","category_id"]
isOneToOne: false
      referencedRelation: "transaction_categories"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "budgets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "budgets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"currencies": {
                  Row: {
                    "code": string,"minor_units": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"minor_units": number,"name": string
                  }
                  Update: {
                    "code"?: string,"minor_units"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"financial_accounts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"currency": string,"id": string,"kind": string,"ledger_account_id": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"currency": string,"id"?: string,"kind": string,"ledger_account_id": string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kind"?: string,"ledger_account_id"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "financial_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_accounts_workspace_id_ledger_account_id_currency_fkey"
      columns: ["workspace_id","ledger_account_id","currency"]
isOneToOne: false
      referencedRelation: "ledger_accounts"
      referencedColumns: ["workspace_id","id","currency"]
    }
                  ]
                },"financial_commands": {
                  Row: {
                    "actor": string,"created_at": string,"idempotency_key": string,"operation": string,"request_fingerprint": string,"result": Json | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"created_at"?: string,"idempotency_key": string,"operation": string,"request_fingerprint": string,"result"?: Json | null,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string,"created_at"?: string,"idempotency_key"?: string,"operation"?: string,"request_fingerprint"?: string,"result"?: Json | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_commands_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "financial_commands_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"income_sources": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_sources_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "income_sources_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_entries": {
                  Row: {
                    "id": string,"posted_at": string,"transaction_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"posted_at"?: string,"transaction_id": string,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"posted_at"?: string,"transaction_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_entries_workspace_id_transaction_id_fkey"
      columns: ["workspace_id","transaction_id"]
isOneToOne: false
      referencedRelation: "transaction_feed"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "journal_entries_workspace_id_transaction_id_fkey"
      columns: ["workspace_id","transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"journal_lines": {
                  Row: {
                    "amount": number,"base_amount": number,"currency": string,"id": string,"journal_entry_id": string,"ledger_account_id": string,"side": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"base_amount": number,"currency": string,"id"?: string,"journal_entry_id": string,"ledger_account_id": string,"side": string,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"base_amount"?: number,"currency"?: string,"id"?: string,"journal_entry_id"?: string,"ledger_account_id"?: string,"side"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_lines_workspace_id_journal_entry_id_fkey"
      columns: ["workspace_id","journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "journal_lines_workspace_id_ledger_account_id_currency_fkey"
      columns: ["workspace_id","ledger_account_id","currency"]
isOneToOne: false
      referencedRelation: "ledger_accounts"
      referencedColumns: ["workspace_id","id","currency"]
    }
                  ]
                },"ledger_accounts": {
                  Row: {
                    "account_class": string,"created_at": string,"currency": string,"id": string,"system_code": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_class": string,"created_at"?: string,"currency": string,"id"?: string,"system_code"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "account_class"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"system_code"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_accounts_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ledger_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "ledger_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"pocket_movements": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string,"currency": string,"from_pocket_id": string | null,"id": string,"note": string | null,"to_pocket_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by": string,"currency": string,"from_pocket_id"?: string | null,"id"?: string,"note"?: string | null,"to_pocket_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string,"currency"?: string,"from_pocket_id"?: string | null,"id"?: string,"note"?: string | null,"to_pocket_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pocket_movements_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_from_pocket_id_fkey"
      columns: ["workspace_id","from_pocket_id"]
isOneToOne: false
      referencedRelation: "pocket_balances"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_from_pocket_id_fkey"
      columns: ["workspace_id","from_pocket_id"]
isOneToOne: false
      referencedRelation: "pockets"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_to_pocket_id_fkey"
      columns: ["workspace_id","to_pocket_id"]
isOneToOne: false
      referencedRelation: "pocket_balances"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "pocket_movements_workspace_id_to_pocket_id_fkey"
      columns: ["workspace_id","to_pocket_id"]
isOneToOne: false
      referencedRelation: "pockets"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"pockets": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"currency": string,"id": string,"name": string,"target_amount": number | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"currency": string,"id"?: string,"name": string,"target_amount"?: number | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"name"?: string,"target_amount"?: number | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pockets_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "pockets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "pockets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transaction_categories": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"kind": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transaction_categories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "transaction_categories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"amount": number,"category_id": string | null,"counter_account_id": string | null,"created_at": string,"created_by": string,"currency": string,"id": string,"income_source_id": string | null,"kind": string,"note": string | null,"occurred_on": string,"refund_of_id": string | null,"reverses_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount": number,"category_id"?: string | null,"counter_account_id"?: string | null,"created_at"?: string,"created_by": string,"currency": string,"id"?: string,"income_source_id"?: string | null,"kind": string,"note"?: string | null,"occurred_on": string,"refund_of_id"?: string | null,"reverses_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount"?: number,"category_id"?: string | null,"counter_account_id"?: string | null,"created_at"?: string,"created_by"?: string,"currency"?: string,"id"?: string,"income_source_id"?: string | null,"kind"?: string,"note"?: string | null,"occurred_on"?: string,"refund_of_id"?: string | null,"reverses_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "transactions_workspace_id_account_id_fkey"
      columns: ["workspace_id","account_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_account_id_fkey"
      columns: ["workspace_id","account_id"]
isOneToOne: false
      referencedRelation: "financial_accounts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_category_id_fkey"
      columns: ["workspace_id","category_id"]
isOneToOne: false
      referencedRelation: "transaction_categories"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_counter_account_id_fkey"
      columns: ["workspace_id","counter_account_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_counter_account_id_fkey"
      columns: ["workspace_id","counter_account_id"]
isOneToOne: false
      referencedRelation: "financial_accounts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_workspace_id_income_source_id_fkey"
      columns: ["workspace_id","income_source_id"]
isOneToOne: false
      referencedRelation: "income_sources"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_refund_of_id_fkey"
      columns: ["workspace_id","refund_of_id"]
isOneToOne: false
      referencedRelation: "transaction_feed"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_refund_of_id_fkey"
      columns: ["workspace_id","refund_of_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_reverses_id_fkey"
      columns: ["workspace_id","reverses_id"]
isOneToOne: false
      referencedRelation: "transaction_feed"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_reverses_id_fkey"
      columns: ["workspace_id","reverses_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"default_workspace_id": string | null,"locale": string,"theme": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_workspace_id"?: string | null,"locale"?: string,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_workspace_id"?: string | null,"locale"?: string,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_settings_default_workspace_id_fkey"
      columns: ["default_workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "user_settings_default_workspace_id_fkey"
      columns: ["default_workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"joined_at": string | null,"role": string,"status": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"joined_at"?: string | null,"role": string,"status": string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"joined_at"?: string | null,"role"?: string,"status"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "base_currency": string,"created_at": string,"created_by": string | null,"id": string,"locale": string,"name": string,"personal_owner_id": string | null,"timezone": string,"updated_at": string,"workspace_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"locale"?: string,"name": string,"personal_owner_id"?: string | null,"timezone"?: string,"updated_at"?: string,"workspace_type": string
                  }
                  Update: {
                    "base_currency"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"locale"?: string,"name"?: string,"personal_owner_id"?: string | null,"timezone"?: string,"updated_at"?: string,"workspace_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_base_currency_fkey"
      columns: ["base_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "archived_at": string | null,"balance": string | null,"created_at": string,"currency": string,"id": string,"kind": string,"name": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "financial_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "financial_accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"pocket_balances": {
                  Row: {
                    "archived_at": string | null,"balance": string | null,"created_at": string,"currency": string,"id": string,"name": string,"target_amount": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "pockets_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "pockets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "pockets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"pocket_summary": {
                  Row: {
                    "allocated": string | null,"eligible_funds": string | null,"is_shortfall": boolean | null,"unallocated": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"transaction_feed": {
                  Row: {
                    "account_id": string | null,"account_name": string | null,"amount": string | null,"category_id": string | null,"category_kind": string | null,"category_name": string | null,"counter_account_id": string | null,"counter_account_name": string | null,"created_at": string,"currency": string,"id": string,"income_source_id": string | null,"income_source_name": string | null,"is_reversed": boolean | null,"kind": string,"note": string | null,"occurred_on": string,"refund_of_id": string | null,"refunded_amount": string | null,"reverses_id": string | null,"signed_amount": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "transactions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "pocket_summary"
      referencedColumns: ["workspace_id"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_workspace_id_income_source_id_fkey"
      columns: ["workspace_id","income_source_id"]
isOneToOne: false
      referencedRelation: "income_sources"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_refund_of_id_fkey"
      columns: ["workspace_id","refund_of_id"]
isOneToOne: false
      referencedRelation: "transaction_feed"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_refund_of_id_fkey"
      columns: ["workspace_id","refund_of_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_reverses_id_fkey"
      columns: ["workspace_id","reverses_id"]
isOneToOne: false
      referencedRelation: "transaction_feed"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "transactions_workspace_id_reverses_id_fkey"
      columns: ["workspace_id","reverses_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "allocate_to_pocket":
{ Args: { "p_amount": string,"p_idempotency_key": string,"p_note"?: string,"p_pocket_id": string,"p_workspace_id": string }; Returns: Json
                           },
"budget_vs_actual":
{ Args: { "p_month": string,"p_workspace_id": string }; Returns: {
              "actual": string,"category_archived": boolean,"category_id": string,"category_name": string,"has_budget": boolean,"is_over": boolean,"planned": string,"remaining": string
            }[]
                           },
"copy_budgets":
{ Args: { "p_from_month": string,"p_to_month": string,"p_workspace_id": string }; Returns: Json
                           },
"create_financial_account":
{ Args: { "p_idempotency_key": string,"p_kind": string,"p_name": string,"p_opened_on"?: string,"p_opening_balance"?: string,"p_workspace_id": string }; Returns: Json
                           },
"create_pocket":
{ Args: { "p_idempotency_key": string,"p_name": string,"p_target_amount"?: string,"p_workspace_id": string }; Returns: Json
                           },
"deallocate_from_pocket":
{ Args: { "p_amount": string,"p_idempotency_key": string,"p_note"?: string,"p_pocket_id": string,"p_workspace_id": string }; Returns: Json
                           },
"edit_transaction":
{ Args: { "p_account_id"?: string,"p_amount"?: string,"p_category_id"?: string,"p_counter_account_id"?: string,"p_idempotency_key": string,"p_income_source_id"?: string,"p_note"?: string,"p_occurred_on"?: string,"p_transaction_id": string,"p_workspace_id": string }; Returns: Json
                           },
"move_between_pockets":
{ Args: { "p_amount": string,"p_from_pocket_id": string,"p_idempotency_key": string,"p_note"?: string,"p_to_pocket_id": string,"p_workspace_id": string }; Returns: Json
                           },
"period_totals":
{ Args: { "p_from": string,"p_to": string,"p_workspace_id": string }; Returns: {
              "category_id": string,"category_name": string,"kind": string,"total": string
            }[]
                           },
"post_expense":
{ Args: { "p_account_id": string,"p_amount": string,"p_category_id": string,"p_idempotency_key": string,"p_note"?: string,"p_occurred_on"?: string,"p_workspace_id": string }; Returns: Json
                           },
"post_income":
{ Args: { "p_account_id": string,"p_amount": string,"p_category_id": string,"p_idempotency_key": string,"p_income_source_id"?: string,"p_note"?: string,"p_occurred_on"?: string,"p_workspace_id": string }; Returns: Json
                           },
"post_refund":
{ Args: { "p_account_id"?: string,"p_amount": string,"p_idempotency_key": string,"p_note"?: string,"p_occurred_on"?: string,"p_refund_of_id": string,"p_workspace_id": string }; Returns: Json
                           },
"post_transfer":
{ Args: { "p_amount": string,"p_from_account_id": string,"p_idempotency_key": string,"p_note"?: string,"p_occurred_on"?: string,"p_to_account_id": string,"p_workspace_id": string }; Returns: Json
                           },
"reverse_transaction":
{ Args: { "p_idempotency_key": string,"p_reason"?: string,"p_transaction_id": string,"p_workspace_id": string }; Returns: Json
                           },
"set_budget":
{ Args: { "p_amount": string,"p_category_id": string,"p_month": string,"p_workspace_id": string }; Returns: Json
                           },
"set_financial_account_archived":
{ Args: { "p_account_id": string,"p_archived": boolean,"p_workspace_id": string }; Returns: Json
                           },
"set_pocket_archived":
{ Args: { "p_archived": boolean,"p_pocket_id": string,"p_workspace_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
