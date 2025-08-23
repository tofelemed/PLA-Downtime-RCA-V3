import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import ReasonCodeTreePicker from '../components/reason-codes/ReasonCodeTreePicker';

// Props type for the form fields
export interface EventFormFieldsProps {
  formState: any;
  setFormState: (updater: any) => void;
  mode: 'create' | 'edit' | 'view';
  errors?: string[];
  units: any[];
  assets: any[];
  impactCodes: any[];
  oeeCodes: any[];
  plans: any[];
  reasonCodes: any[];
  selectedReasonCode: any;
  setSelectedReasonCode: (rc: any) => void;
  showReasonCodeModal: boolean;
  setShowReasonCodeModal: (open: boolean) => void;
  // Smart prompt states/handlers
  operatorPrompt?: string;
  shiftPrompt?: string;
  crewPrompt?: string;
  showOperatorPrompt?: boolean;
  setShowOperatorPrompt?: (b: boolean) => void;
  showShiftPrompt?: boolean;
  setShowShiftPrompt?: (b: boolean) => void;
  showCrewPrompt?: boolean;
  setShowCrewPrompt?: (b: boolean) => void;
  readOnly?: boolean;
}

const EventFormFields: React.FC<EventFormFieldsProps> = ({
  formState,
  setFormState,
  mode,
  errors,
  units,
  assets,
  impactCodes,
  oeeCodes,
  plans,
  reasonCodes,
  selectedReasonCode,
  setSelectedReasonCode,
  showReasonCodeModal,
  setShowReasonCodeModal,
  operatorPrompt,
  shiftPrompt,
  crewPrompt,
  showOperatorPrompt,
  setShowOperatorPrompt,
  showShiftPrompt,
  setShowShiftPrompt,
  showCrewPrompt,
  setShowCrewPrompt,
  readOnly = false,
}) => {
  // Helper for quality check
  const impact = impactCodes.find((c: any) => c.id === formState.impactCodeId);
  const oee = oeeCodes.find((c: any) => c.id === formState.oeeCodeId);
  const isQuality = impact?.category === 'Quality' || oee?.impactType === 'Quality';

  return (
    <div className="space-y-4">
      {/* Event Type (only in create mode) */}
      {mode === 'create' && (
        <div className="space-y-2">
          <Label htmlFor="eventType">Event Type</Label>
          <Select value={formState.eventType} onValueChange={value => setFormState((prev: any) => ({ ...prev, eventType: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ProductionLoss">Production Loss</SelectItem>
              <SelectItem value="IOW">IOW</SelectItem>
              <SelectItem value="SOL">SOL</SelectItem>
              <SelectItem value="APM">APM Events</SelectItem>
              <SelectItem value="FailureWO">Failure WOs</SelectItem>
              <SelectItem value="ProductionOutput">Production Output</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {/* --- ProductionLoss fields --- */}
      {formState.eventType === 'ProductionLoss' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="unit">Production Unit</Label>
            <Select value={formState.unitId} onValueChange={value => setFormState((prev: any) => ({ ...prev, unitId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit: any) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset">Asset (Optional)</Label>
            <Select value={formState.assetId} onValueChange={value => setFormState((prev: any) => ({ ...prev, assetId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset: any) => (
                  <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Impact Code dropdown with search */}
          <div className="space-y-2">
            <Label htmlFor="impactCodeId">Impact Code</Label>
            <Select
              value={formState.impactCodeId}
              onValueChange={value => setFormState((prev: any) => ({ ...prev, impactCodeId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select impact code" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <div className="px-2 py-1">
                  <Input
                    type="text"
                    placeholder="Search impact code..."
                    className="w-full mb-2"
                    value={formState.impactCodeSearch || ''}
                    onChange={e => setFormState((prev: any) => ({ ...prev, impactCodeSearch: e.target.value }))}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                {(impactCodes.filter((code: any) => {
                  const q = (formState.impactCodeSearch || '').toLowerCase();
                  return !q || code.code.toLowerCase().includes(q) || code.name.toLowerCase().includes(q) || (code.category || '').toLowerCase().includes(q);
                })).map((code: any) => (
                  <SelectItem key={code.id} value={code.id}>{code.code} - {code.name} ({code.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* OEE Code dropdown with search */}
          <div className="space-y-2">
            <Label htmlFor="oeeCodeId">OEE Code</Label>
            <Select
              value={formState.oeeCodeId}
              onValueChange={value => setFormState((prev: any) => ({ ...prev, oeeCodeId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select OEE code" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <div className="px-2 py-1">
                  <Input
                    type="text"
                    placeholder="Search OEE code..."
                    className="w-full mb-2"
                    value={formState.oeeCodeSearch || ''}
                    onChange={e => setFormState((prev: any) => ({ ...prev, oeeCodeSearch: e.target.value }))}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                {(oeeCodes.filter((code: any) => {
                  const q = (formState.oeeCodeSearch || '').toLowerCase();
                  return !q || code.code.toLowerCase().includes(q) || code.name.toLowerCase().includes(q) || (code.impactType || '').toLowerCase().includes(q);
                })).map((code: any) => (
                  <SelectItem key={code.id} value={code.id}>{code.code} - {code.name} ({code.impactType})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input id="startTime" type="datetime-local" value={formState.startTime} onChange={e => setFormState((prev: any) => ({ ...prev, startTime: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time (Optional)</Label>
            <Input id="endTime" type="datetime-local" value={formState.endTime} onChange={e => setFormState((prev: any) => ({ ...prev, endTime: e.target.value }))} />
          </div>
          {/* Duration (auto-calculated, read-only) */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)
              <span title="Calculated automatically from start and end time" className="ml-1 text-blue-500 cursor-help">🛈</span>
            </Label>
            <Input
              id="duration"
              type="number"
              value={formState.startTime && formState.endTime ?
                Math.max(0, Math.round((new Date(formState.endTime).getTime() - new Date(formState.startTime).getTime()) / 60000)) : ''}
              readOnly
              className="bg-gray-100 cursor-not-allowed"
              placeholder="Auto-calculated from start/end time"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Lost</Label>
            <Input id="quantity" type="number" value={formState.quantity} onChange={e => setFormState((prev: any) => ({ ...prev, quantity: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Estimated Cost ($)</Label>
            <Input id="cost" type="number" value={formState.cost} onChange={e => setFormState((prev: any) => ({ ...prev, cost: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lossCategory">Loss Type/Category</Label>
            <Select value={formState.lossCategory || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, lossCategory: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select loss type/category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Downtime">Downtime</SelectItem>
                <SelectItem value="Breakdown">Breakdown</SelectItem>
                <SelectItem value="Setup">Setup</SelectItem>
                <SelectItem value="Changeover">Changeover</SelectItem>
                <SelectItem value="Minor Stoppage">Minor Stoppage</SelectItem>
                <SelectItem value="Reduced Speed">Reduced Speed</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reasonCode">Reason Code (ISA-95)</Label>
            <div className="flex gap-2 items-center">
              <Button type="button" variant="outline" onClick={() => setShowReasonCodeModal(true)}>
                {selectedReasonCode ? `${selectedReasonCode.code} - ${selectedReasonCode.name}` : 'Select Reason Code'}
              </Button>
              {selectedReasonCode && (
                <Button type="button" size="icon" variant="ghost" onClick={() => { setSelectedReasonCode(null); setFormState((prev: any) => ({ ...prev, reasonCodeId: '' })); }}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <ReasonCodeTreePicker
              open={showReasonCodeModal}
              onOpenChange={setShowReasonCodeModal}
              reasonCodes={reasonCodes}
              value={formState.reasonCodeId || ''}
              onSelect={rc => {
                setSelectedReasonCode(rc);
                setFormState((prev: any) => ({ ...prev, reasonCodeId: rc?.id || '' }));
                setShowReasonCodeModal(false);
              }}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            {readOnly ? <div>{formState.description}</div> : <Textarea id="description" value={formState.description} onChange={e => setFormState((prev: any) => ({ ...prev, description: e.target.value }))} />}
          </div>
        </>
      )}
      {/* --- IOW/SOL fields --- */}
      {['IOW', 'SOL'].includes(formState.eventType) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="parameter">Parameter</Label>
            <Select value={formState.parameter || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, parameter: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select parameter" />
              </SelectTrigger>
              <SelectContent>
                {['Pressure', 'Temperature', 'Flow', 'Level'].map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">What process parameter was breached?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="limit">Limit</Label>
            <Input id="limit" type="text" value={formState.limit || ''} onChange={e => setFormState((prev: any) => ({ ...prev, limit: e.target.value }))} />
            <p className="text-xs text-gray-500">Auto-filled based on parameter, can be overridden.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="limitType">Limit Type</Label>
            <Select value={formState.limitType || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, limitType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select limit type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Auto-filled based on parameter, can be overridden.</p>
          </div>
        </>
      )}
      {/* --- SOL type --- */}
      {formState.eventType === 'SOL' && (
        <div className="space-y-2">
          <Label htmlFor="solType">SOL Type</Label>
          <Select value={formState.solType || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, solType: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select SOL type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Safety">Safety</SelectItem>
              <SelectItem value="Operational">Operational</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Is this a Safety or Operational limit?</p>
        </div>
      )}
      {/* --- APM fields --- */}
      {formState.eventType === 'APM' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="apmType">APM Type</Label>
            <Select value={formState.apmType || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, apmType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select APM type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Health">Health</SelectItem>
                <SelectItem value="Prediction">Prediction</SelectItem>
                <SelectItem value="Alert">Alert</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">What type of APM event is this?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recommendedAction">Recommended Action</Label>
            <Input id="recommendedAction" type="text" value={formState.recommendedAction || ''} onChange={e => setFormState((prev: any) => ({ ...prev, recommendedAction: e.target.value }))} />
            <p className="text-xs text-gray-500">Auto-filled based on APM type, can be overridden.</p>
          </div>
        </>
      )}
      {/* --- FailureWO fields --- */}
      {formState.eventType === 'FailureWO' && (
        <div className="space-y-2">
          <Label htmlFor="failureMode">Failure Mode</Label>
          <Select value={formState.failureMode || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, failureMode: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select failure mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bearing Failure">Bearing Failure</SelectItem>
              <SelectItem value="Seal Leak">Seal Leak</SelectItem>
              <SelectItem value="Overheating">Overheating</SelectItem>
              <SelectItem value="Electrical Fault">Electrical Fault</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">What was the failure mode?</p>
        </div>
      )}
      {/* --- Defective Quantity for Quality events --- */}
      {isQuality && (
        <div className="space-y-2">
          <Label htmlFor="defectiveQuantity">Defective Quantity</Label>
          <Input id="defectiveQuantity" type="number" value={formState.defectiveQuantity || ''} onChange={e => setFormState((prev: any) => ({ ...prev, defectiveQuantity: e.target.value }))} />
        </div>
      )}
      {/* --- ProductionOutput fields --- */}
      {formState.eventType === 'ProductionOutput' && (
        <>
          {/* Production Plan */}
          <div className="space-y-2">
            <Label htmlFor="planId">Production Plan</Label>
            <Select value={formState.planId || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, planId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Production Unit */}
          <div className="space-y-2">
            <Label htmlFor="unitId">Production Unit</Label>
            <Select value={formState.unitId || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, unitId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit: any) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Description */}
          <div className="col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            {readOnly ? <div>{formState.description}</div> : <Textarea id="description" value={formState.description} onChange={e => setFormState((prev: any) => ({ ...prev, description: e.target.value }))} />}
          </div>
          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input id="startTime" type="datetime-local" value={formState.startTime || ''} onChange={e => setFormState((prev: any) => ({ ...prev, startTime: e.target.value }))} />
          </div>
          {/* End Time */}
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time (Optional)</Label>
            <Input id="endTime" type="datetime-local" value={formState.endTime || ''} onChange={e => setFormState((prev: any) => ({ ...prev, endTime: e.target.value }))} />
          </div>
          {/* Duration (auto-calculated, read-only) */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)
              <span title="Calculated automatically from start and end time" className="ml-1 text-blue-500 cursor-help">🛈</span>
            </Label>
            <Input
              id="duration"
              type="number"
              value={formState.startTime && formState.endTime ?
                Math.max(0, Math.round((new Date(formState.endTime).getTime() - new Date(formState.startTime).getTime()) / 60000)) : ''}
              readOnly
              className="bg-gray-100 cursor-not-allowed"
              placeholder="Auto-calculated from start/end time"
            />
          </div>
          {/* Quantity Produced */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Produced</Label>
            <Input id="quantity" type="number" value={formState.quantity || ''} onChange={e => setFormState((prev: any) => ({ ...prev, quantity: e.target.value }))} />
          </div>
          {/* Defective Quantity */}
          <div className="space-y-2">
            <Label htmlFor="defectiveQuantity">Defective Quantity <span title="Number of defective units for this event. Used for OEE Quality calculation." className="text-blue-600 cursor-help">🛈</span></Label>
            <Input id="defectiveQuantity" type="number" placeholder="0" value={formState.defectiveQuantity || ''} onChange={e => setFormState((prev: any) => ({ ...prev, defectiveQuantity: e.target.value }))} />
          </div>
        </>
      )}
      {/* --- Operator/Recorder with Smart Prompt --- */}
      <div className="space-y-2">
        <Label htmlFor="operator">Operator/Recorder</Label>
        {readOnly ? <div>{formState.operatorName}</div> : (
          <Input id="operator" type="text" value={formState.operatorName || ''} onChange={e => setFormState((prev: any) => ({ ...prev, operatorName: e.target.value }))} placeholder="Operator name" />
        )}
        {showOperatorPrompt && operatorPrompt && setShowOperatorPrompt && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg shadow-sm">
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center text-blue-700 text-xs font-bold">💡</div>
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium mb-1">Smart Operator Suggestion</p>
                <p className="text-xs text-blue-700">{operatorPrompt}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Button size="sm" variant="outline" className="text-xs bg-white border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { setFormState((prev: any) => ({ ...prev, operatorName: operatorPrompt.includes('Day') ? 'Day Shift Operator' : operatorPrompt.includes('Swing') ? 'Swing Shift Operator' : 'Night Shift Operator' })); setShowOperatorPrompt(false); }}>Apply Suggestion</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-blue-600 hover:text-blue-800" onClick={() => setShowOperatorPrompt(false)}>Dismiss</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- Shift with Smart Prompt --- */}
      <div className="space-y-2">
        <Label htmlFor="shift">Shift</Label>
        {readOnly ? <div>{formState.shift}</div> : (
          <Select value={formState.shift || ''} onValueChange={value => setFormState((prev: any) => ({ ...prev, shift: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Day">Day</SelectItem>
              <SelectItem value="Night">Night</SelectItem>
              <SelectItem value="Swing">Swing</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showShiftPrompt && shiftPrompt && setShowShiftPrompt && (
          <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg shadow-sm">
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-200 to-orange-200 flex items-center justify-center text-yellow-700 text-xs font-bold">🌅</div>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium mb-1">Shift Time Detection</p>
                <p className="text-xs text-yellow-700">{shiftPrompt}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Button size="sm" variant="outline" className="text-xs bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => { setFormState((prev: any) => ({ ...prev, shift: shiftPrompt.includes('Day') ? 'Day' : shiftPrompt.includes('Swing') ? 'Swing' : 'Night' })); setShowShiftPrompt(false); }}>Apply Shift</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-yellow-600 hover:text-yellow-800" onClick={() => setShowShiftPrompt(false)}>Dismiss</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- Crew with Smart Prompt --- */}
      <div className="space-y-2">
        <Label htmlFor="crew">Crew</Label>
        {readOnly ? <div>{formState.crew}</div> : (
          <Input id="crew" type="text" value={formState.crew || ''} onChange={e => setFormState((prev: any) => ({ ...prev, crew: e.target.value }))} placeholder="Crew name or code" />
        )}
        {showCrewPrompt && crewPrompt && setShowCrewPrompt && (
          <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg shadow-sm">
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center text-green-700 text-xs font-bold">👥</div>
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium mb-1">Crew Activity Suggestion</p>
                <p className="text-xs text-green-700">{crewPrompt}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Button size="sm" variant="outline" className="text-xs bg-white border-green-300 text-green-700 hover:bg-green-50" onClick={() => { setFormState((prev: any) => ({ ...prev, crew: crewPrompt.match(/(Alpha|Bravo|Charlie|Delta) Crew/)?.[0] || '' })); setShowCrewPrompt(false); }}>Apply Crew</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-green-600 hover:text-green-800" onClick={() => setShowCrewPrompt(false)}>Dismiss</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- Error display --- */}
      {errors && errors.length > 0 && (
        <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );
};

export default EventFormFields; 