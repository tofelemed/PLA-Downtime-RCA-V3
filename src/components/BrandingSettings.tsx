import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { brandingService, BrandingSettings as BrandingSettingsType } from '@/services/BrandingService';
import { Loader2, Palette, RotateCcw, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BrandingSettings: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BrandingSettingsType | null>(null);
  const [formData, setFormData] = useState({
    appName: '',
    appSubtitle: '',
    logoUrl: '',
    logoInitials: '',
    primaryColor: '',
    secondaryColor: '',
    faviconUrl: '',
    logoSize: 32,
    logoObjectFit: 'contain' as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
    logoBorderRadius: 4,
    logoContainerSize: 40,
    logoContainerRadius: 12,
    logoContainerPadding: 0,
    logoBackgroundOpacity: 1,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = await brandingService.getBranding();
      setSettings(currentSettings);
      setFormData({
        appName: currentSettings.appName || '',
        appSubtitle: currentSettings.appSubtitle || '',
        logoUrl: currentSettings.logoUrl || '',
        logoInitials: currentSettings.logoInitials || '',
        primaryColor: currentSettings.primaryColor || '#2563eb',
        secondaryColor: currentSettings.secondaryColor || '#ec4899',
        faviconUrl: currentSettings.faviconUrl || '',
        logoSize: currentSettings.logoSize ?? 32,
        logoObjectFit: currentSettings.logoObjectFit || 'contain',
        logoBorderRadius: currentSettings.logoBorderRadius ?? 4,
        logoContainerSize: currentSettings.logoContainerSize ?? 40,
        logoContainerRadius: currentSettings.logoContainerRadius ?? 12,
        logoContainerPadding: currentSettings.logoContainerPadding ?? 0,
        logoBackgroundOpacity: currentSettings.logoBackgroundOpacity ?? 1,
      });
    } catch (error) {
      console.error('Failed to load branding settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load branding settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await brandingService.saveBranding(
        {
          appName: formData.appName,
          appSubtitle: formData.appSubtitle,
          logoUrl: formData.logoUrl,
          logoInitials: formData.logoInitials,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          faviconUrl: formData.faviconUrl,
          logoSize: formData.logoSize,
          logoObjectFit: formData.logoObjectFit,
          logoBorderRadius: formData.logoBorderRadius,
          logoContainerSize: formData.logoContainerSize,
          logoContainerRadius: formData.logoContainerRadius,
          logoContainerPadding: formData.logoContainerPadding,
          logoBackgroundOpacity: formData.logoBackgroundOpacity,
        },
        session?.user?.name
      );
      
      toast({
        title: 'Success',
        description: 'Branding settings saved successfully. Refresh the page to see changes.',
      });

      // Reload to refresh the cache
      await loadSettings();

      // Trigger a custom event to notify Layout component
      window.dispatchEvent(new CustomEvent('brandingUpdated'));
    } catch (error) {
      console.error('Failed to save branding settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save branding settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to default branding?')) {
      return;
    }

    try {
      setSaving(true);
      await brandingService.resetBranding();
      toast({
        title: 'Success',
        description: 'Branding reset to default. Refresh the page to see changes.',
      });
      await loadSettings();
      window.dispatchEvent(new CustomEvent('brandingUpdated'));
    } catch (error) {
      console.error('Failed to reset branding:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset branding',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (field: 'logoUrl' | 'faviconUrl', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size should be less than 2MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setFormData(prev => ({ ...prev, [field]: base64 }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-blue-600" />
            Branding Settings
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the application name, logo, and colors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Application Name */}
        <Card>
          <CardHeader>
            <CardTitle>Application Name</CardTitle>
            <CardDescription>
              The main title displayed in the header
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="appName">Application Name *</Label>
              <Input
                id="appName"
                value={formData.appName}
                onChange={(e) => setFormData(prev => ({ ...prev, appName: e.target.value }))}
                placeholder="e.g., Unified APM"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="appSubtitle">Subtitle (Optional)</Label>
              <Input
                id="appSubtitle"
                value={formData.appSubtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, appSubtitle: e.target.value }))}
                placeholder="e.g., Asset Performance Management"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Logo Configuration</CardTitle>
            <CardDescription>
              Upload a logo or use initials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="logoInitials">Logo Initials</Label>
              <Input
                id="logoInitials"
                value={formData.logoInitials}
                onChange={(e) => setFormData(prev => ({ ...prev, logoInitials: e.target.value.substring(0, 3) }))}
                placeholder="e.g., UA"
                maxLength={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max 3 characters. Used when no logo image is provided.
              </p>
            </div>
            <div>
              <Label htmlFor="logoUrl">Logo Image URL or Upload</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="logoUrl"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('logoUpload')?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload('logoUrl', e)}
                />
              </div>
              {formData.logoUrl && (
                <div className="mt-2 p-2 border rounded-lg bg-gray-50">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="max-h-16 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logo Styling Options */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Logo Styling Options</CardTitle>
            <CardDescription>
              Customize logo size, fit, border radius, and container settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Logo Size */}
              <div>
                <Label htmlFor="logoSize">Logo Size (px)</Label>
                <Input
                  id="logoSize"
                  type="number"
                  min="16"
                  max="128"
                  value={formData.logoSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoSize: parseInt(e.target.value) || 32 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Width/height of logo image (16-128px)
                </p>
              </div>

              {/* Logo Object Fit */}
              <div>
                <Label htmlFor="logoObjectFit">Logo Fit</Label>
                <Select
                  value={formData.logoObjectFit}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, logoObjectFit: value }))}
                >
                  <SelectTrigger id="logoObjectFit" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain">Contain (Default)</SelectItem>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="scale-down">Scale Down</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  How logo fits in its space
                </p>
              </div>

              {/* Logo Border Radius */}
              <div>
                <Label htmlFor="logoBorderRadius">Logo Radius (px)</Label>
                <Input
                  id="logoBorderRadius"
                  type="number"
                  min="0"
                  max="64"
                  value={formData.logoBorderRadius}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoBorderRadius: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Logo corner rounding (0-64px)
                </p>
              </div>

              {/* Logo Container Size */}
              <div>
                <Label htmlFor="logoContainerSize">Container Size (px)</Label>
                <Input
                  id="logoContainerSize"
                  type="number"
                  min="24"
                  max="160"
                  value={formData.logoContainerSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoContainerSize: parseInt(e.target.value) || 40 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Container background size (24-160px)
                </p>
              </div>

              {/* Logo Container Radius */}
              <div>
                <Label htmlFor="logoContainerRadius">Container Radius (px)</Label>
                <Input
                  id="logoContainerRadius"
                  type="number"
                  min="0"
                  max="80"
                  value={formData.logoContainerRadius}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoContainerRadius: parseInt(e.target.value) || 12 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Container corner rounding (0-80px)
                </p>
              </div>

              {/* Logo Container Padding */}
              <div>
                <Label htmlFor="logoContainerPadding">Container Padding (px)</Label>
                <Input
                  id="logoContainerPadding"
                  type="number"
                  min="0"
                  max="32"
                  value={formData.logoContainerPadding}
                  onChange={(e) => setFormData(prev => ({ ...prev, logoContainerPadding: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Space inside container (0-32px)
                </p>
              </div>

              {/* Background Opacity */}
              <div className="md:col-span-3">
                <Label htmlFor="logoBackgroundOpacity">Background Gradient Opacity</Label>
                <div className="flex items-center gap-4 mt-1">
                  <Input
                    id="logoBackgroundOpacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.logoBackgroundOpacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, logoBackgroundOpacity: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {Math.round(formData.logoBackgroundOpacity * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Transparency of the gradient background (0% = transparent, 100% = opaque)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Color Theme</CardTitle>
            <CardDescription>
              Customize the primary and secondary colors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-20 h-10 p-1"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-20 h-10 p-1"
                />
                <Input
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  placeholder="#ec4899"
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Favicon Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
            <CardDescription>
              Upload a favicon for browser tabs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="faviconUrl">Favicon URL or Upload</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="faviconUrl"
                  value={formData.faviconUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, faviconUrl: e.target.value }))}
                  placeholder="https://example.com/favicon.ico"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('faviconUpload')?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  id="faviconUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload('faviconUrl', e)}
                />
              </div>
              {formData.faviconUrl && (
                <div className="mt-2 p-2 border rounded-lg bg-gray-50">
                  <img
                    src={formData.faviconUrl}
                    alt="Favicon preview"
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Recommended size: 32x32 or 64x64 pixels
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Card */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-pink-50">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Preview how your branding will look
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm">
            <div
              className="flex items-center justify-center shadow-lg"
              style={{
                width: `${formData.logoContainerSize}px`,
                height: `${formData.logoContainerSize}px`,
                borderRadius: `${formData.logoContainerRadius}px`,
                padding: `${formData.logoContainerPadding}px`,
                background: `linear-gradient(to bottom right, ${formData.primaryColor}, ${formData.secondaryColor})`,
                opacity: formData.logoBackgroundOpacity,
              }}
            >
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Logo"
                  style={{
                    width: `${formData.logoSize}px`,
                    height: `${formData.logoSize}px`,
                    objectFit: formData.logoObjectFit,
                    borderRadius: `${formData.logoBorderRadius}px`,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : (
                <span className="text-white font-bold" style={{ fontSize: `${formData.logoSize / 2.5}px` }}>
                  {formData.logoInitials || 'UA'}
                </span>
              )}
            </div>
            <div>
              <h1
                className="text-xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${formData.primaryColor}, ${formData.secondaryColor})`,
                }}
              >
                {formData.appName || 'Unified APM'}
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                {formData.appSubtitle || 'Asset Performance Management'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
              {settings.updatedBy && <p>Updated by: {settings.updatedBy}</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BrandingSettings;

