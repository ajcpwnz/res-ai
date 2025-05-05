import type { Address, Property as BaseProperty } from 'prisma'
import type { DataSource } from '../providers'

export type StageKey = string;

export enum ModelType {
  MultiFamily = 'MultiFamily',
  Residential = 'Residential',
}

export interface ModelAssesmentStage {
  key: StageKey;
  outputs: DataSource[];
  final?: boolean;
}

export type Property = BaseProperty & {
  meta: Record<string, any>;
}

export type PropertyDetails = Property & {
  address: Address | null
}

export type PropertyWithAddress = Property & { address: Address }

export interface ModelAssesment {
  property: PropertyDetails;

  done: boolean;
  type: ModelType;
  stages: Record<StageKey, ModelAssesmentStage>;
  order: StageKey[];

  prepare: () => Promise<void>;

  currentStage: StageKey;
  processStage: (stage: StageKey) => Promise<any>;
  reload: () => Promise<void>;

  meta: Record<string, any>
}
