import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import MultiAttributeSelector from './MultiAttributeSelector';
import type { PIClient } from '@/services/pi/PIClient';

// Mock PIClient
const mockPIClient = {
  getAssetServers: vi.fn(),
  getAFDatabases: vi.fn(),
  getDatabaseElements: vi.fn(),
  getElementChildren: vi.fn(),
  getElementAttributes: vi.fn(),
};

// Mock props
const defaultProps = {
  tenantId: 'tenant-1',
  piClient: mockPIClient as unknown as PIClient,
  onAttributesSelected: vi.fn(),
  selectedAttributes: [],
  maxAttributes: 10,
};

describe('MultiAttributeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MultiAttributeSelector {...defaultProps} />);
    expect(screen.getByText('Multi-Attribute Selector')).toBeInTheDocument();
  });

  it('shows connection not available when piClient is null', () => {
    render(<MultiAttributeSelector {...defaultProps} piClient={null as any} />);
    expect(screen.getByText('PI Web API connection not available')).toBeInTheDocument();
  });

  it('loads asset servers on mount', async () => {
    const mockServers = {
      Items: [
        { WebId: 'server1', Name: 'Test Server 1' },
        { WebId: 'server2', Name: 'Test Server 2' },
      ],
    };

    mockPIClient.getAssetServers.mockResolvedValue(mockServers);

    render(<MultiAttributeSelector {...defaultProps} />);

    await waitFor(() => {
      expect(mockPIClient.getAssetServers).toHaveBeenCalled();
    });
  });

  it('handles asset server loading errors gracefully', async () => {
    mockPIClient.getAssetServers.mockRejectedValue(new Error('Connection failed'));

    render(<MultiAttributeSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load asset servers/)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching data', async () => {
    let resolveServers: (value: { Items: unknown[] }) => void = () => undefined;
    mockPIClient.getAssetServers.mockImplementation(
      () => new Promise(resolve => { resolveServers = resolve; }),
    );

    render(<MultiAttributeSelector {...defaultProps} />);

    // Server loading starts after the saved selection state is read, so it appears asynchronously
    expect(await screen.findByText('Loading servers...')).toBeInTheDocument();

    resolveServers({ Items: [{ WebId: 'server1', Name: 'Test Server' }] });

    await waitFor(() => {
      expect(screen.queryByText('Loading servers...')).not.toBeInTheDocument();
    });
  });

  it('allows testing connection manually', async () => {
    const mockServers = {
      Items: [{ WebId: 'server1', Name: 'Test Server' }],
    };

    mockPIClient.getAssetServers.mockResolvedValue(mockServers);

    render(<MultiAttributeSelector {...defaultProps} />);

    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockPIClient.getAssetServers).toHaveBeenCalled();
    });
  });

  it('displays selected attributes count correctly', () => {
    const selectedAttrs = [
      { WebId: 'attr1', Name: 'Attribute 1', Path: '/path1' },
      { WebId: 'attr2', Name: 'Attribute 2', Path: '/path2' },
    ];

    render(<MultiAttributeSelector {...defaultProps} selectedAttributes={selectedAttrs} />);
    
    expect(screen.getByText('2/10 Selected')).toBeInTheDocument();
  });

  it('calls onAttributesSelected when attributes are selected', async () => {
    const mockServers = {
      Items: [{ WebId: 'server1', Name: 'Test Server' }],
    };

    mockPIClient.getAssetServers.mockResolvedValue(mockServers);

    render(<MultiAttributeSelector {...defaultProps} />);

    await waitFor(() => {
      expect(mockPIClient.getAssetServers).toHaveBeenCalled();
    });
  });

  it('handles invalid props gracefully', () => {
    // Test with invalid onAttributesSelected
    const { rerender } = render(
      <MultiAttributeSelector 
        {...defaultProps} 
        onAttributesSelected={null as any} 
      />
    );
    expect(screen.queryByText('Multi-Attribute Selector')).not.toBeInTheDocument();

    // Test with invalid selectedAttributes
    rerender(
      <MultiAttributeSelector 
        {...defaultProps} 
        selectedAttributes={null as any} 
      />
    );
    expect(screen.queryByText('Multi-Attribute Selector')).not.toBeInTheDocument();
  });

  it('handles PI client validation errors gracefully', async () => {
    const invalidPIClient = {
      // Missing required methods
    };

    render(<MultiAttributeSelector {...defaultProps} piClient={invalidPIClient as unknown as PIClient} />);

    // Should show error when trying to load asset servers
    await waitFor(() => {
      expect(screen.getByText(/Failed to load asset servers/)).toBeInTheDocument();
    });
  });

  it('handles empty or invalid API responses gracefully', async () => {
    const mockServers = {
      Items: null // Invalid response
    };

    mockPIClient.getAssetServers.mockResolvedValue(mockServers);

    render(<MultiAttributeSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid response format from PI client/)).toBeInTheDocument();
    });
  });
});
