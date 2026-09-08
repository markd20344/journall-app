import Dexie, { type Table } from "dexie";
import type { FamilyEvent, FamilyMedia, FamilyMember, FamilyRecord, Person, Relationship } from "../types";

export interface SettingRecord {
  key: string;
  value: unknown;
}

class FamilyTreeDB extends Dexie {
  people!: Table<Person, string>;
  relationships!: Table<Relationship, string>;
  familyEvents!: Table<FamilyEvent, string>;
  familyMedia!: Table<FamilyMedia, string>;
  familyRecords!: Table<FamilyRecord, string>;
  familyMembers!: Table<FamilyMember, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("family-tree-db");
    this.version(1).stores({
      people: "id, lastName, updatedAt",
      relationships: "id, type, personA, personB, updatedAt",
      familyEvents: "id, personId, type, updatedAt",
      familyMedia: "id, updatedAt",
      familyRecords: "id, updatedAt",
      familyMembers: "uid, email, updatedAt",
      settings: "key",
    });
  }
}

export const db = new FamilyTreeDB();
