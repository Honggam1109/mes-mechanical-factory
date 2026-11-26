export type OrderStatus = "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export type WorkStatus = "UNASSIGNED" | "ASSIGNED" | "PAUSED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export interface StepPlan {
  stepId: string

  start: string

  end: string

  note: string
}

export interface PlannedStep extends StepPlan {
  order: number

  operationId: string

  code: string

  name: string

  allowedUnitIds: string[]

  unitNames: string[]
}

export interface MaterialRequirement {
  material: string

  code: string

  name: string

  category: string

  unit: string

  norm: number

  required: number

  waste: number

  total: number

  note: string
}

export interface OrderSnapshot {
  product: ProductSnapshot

  route: RouteSnapshot

  bom: BomSnapshot

  steps: PlannedStep[]

  materials: MaterialRequirement[]
}

export interface ManufacturingOrder {
  id: string

  code: string

  productId: string

  routeId: string

  quantity: number

  priority: string

  start: string

  end: string

  note: string

  status: OrderStatus

  plans: StepPlan[]

  sourceSnapshot?: OrderSnapshot

  createdBy: string

  createdAt: string

  updatedAt: string

  releasedAt?: string

  cancelledAt?: string
}

export interface WorkOrder {
  id: string

  code: string

  orderId: string

  stepId: string

  stationId: string
}

export interface ShiftAssignment {
  plannedStart?: string
  plannedEnd?: string
  id: string

  workOrderId: string

  employeeId: string

  shiftId: string

  date: string

  quantity?: number

  note: string

  status: "ACTIVE" | "CANCELLED"

  createdBy: string

  createdAt: string

  shiftSnapshot: {
    code: string

    name: string

    start: string

    end: string

    breakMinutes: number
  }

  employeeSnapshot: EmployeeSnapshot
}

export interface ExecutionReport {
  id: string

  workOrderId: string

  assignmentId: string

  kind: "START" | "REPORT" | "COMPLETE" | "PAUSE" | "RESUME"

  at: string

  quantity?: number

  note?: string

  stationId?: string

  employeeId?: string

  shiftId?: string

  date?: string

  employeeName?: string

  shiftName?: string

  reasonId?: string

  reasonName?: string

  reasonGroup?: string

  machineId?: string

  machineName?: string

  createdBy?: string

  good: number

  ng: number
}

export interface ProductionState {
  productionOrders: ManufacturingOrder[]

  workOrders: WorkOrder[]

  assignments: ShiftAssignment[]

  productionExecutions: ExecutionReport[]
}

export interface ProductSnapshot {
  id: string

  code: string

  name: string

  unit: string
}

export interface RouteSnapshot {
  id: string

  code: string

  name: string

  version: string
}

export interface BomSnapshot {
  id: string

  code: string

  quantity: number
}

export interface EmployeeSnapshot {
  code: string

  name: string

  productionUnitId: string
}

export interface ShiftTime {
  start: string

  end: string
}
