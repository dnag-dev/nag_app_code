// Nag Digital Twin - Button Attribute Fixes
// This script fixes issues with button attributes

(function() {
    console.log("Nag Button Fix module loading...");
    
    // Helper function to log button fix actions
    function logButtonFix(action, element) {
        console.log(`[Button Fix] ${action}: ${element.id || element.className || 'anonymous element'}`);
    }
    
    // Enhanced button attribute cleanup
    function cleanupButtonAttributes(element) {
        if (!element) return;
        
        // List of problematic attributes to explicitly remove
        const problematicAttrs = [
            'iconName', 'layoutTraits', 'src', 'data-icon', 
            'data-src', 'data-layout', 'background', 'backgroundimage'
        ];
        
        // Essential attributes to keep
        const essentialAttrs = [
            'id', 'class', 'role', 'tabindex', 'aria-label', 'disabled', 'type'
        ];
        
        // Handle onclick and event handlers separately
        const onclickHandler = element.onclick;
        
        // First, explicitly remove the known problematic attributes
        problematicAttrs.forEach(attr => {
            if (element.hasAttribute(attr)) {
                try {
                    element.removeAttribute(attr);
                    logButtonFix(`Removed attribute ${attr}`, element);
                } catch (e) {
                    console.warn(`Failed to remove attribute ${attr}:`, e);
                }
            }
        });
        
        // Remove ALL attributes except essentials
        const attrs = Array.from(element.attributes);
        for (let i = attrs.length - 1; i >= 0; i--) {
            const attrName = attrs[i].name.toLowerCase();
            // Keep only essential attributes and event handlers
            if (!essentialAttrs.includes(attrName) && !attrName.startsWith('on')) {
                try {
                    element.removeAttribute(attrs[i].name);
                } catch (e) {
                    console.warn(`Failed to remove attribute ${attrs[i].name}:`, e);
                }
            }
        }
        
        // Restore onclick handler if it was present
        if (onclickHandler) {
            element.onclick = onclickHandler;
        }
        
        // Apply minimal required styles
        element.style = ""; // Clear all styles
        element.style.webkitAppearance = 'none';
        element.style.appearance = 'none';
        element.style.webkitTapHighlightColor = 'transparent';
        
        // Remove all children with iconName or layoutTraits
        Array.from(element.children).forEach(child => {
            if (child.hasAttribute('iconName') || 
                child.hasAttribute('layoutTraits') || 
                child.hasAttribute('src')) {
                try {
                    element.removeChild(child);
                    logButtonFix("Removed problematic child element", child);
                } catch (e) {
                    console.warn("Failed to remove child element:", e);
                }
            }
        });
        
        return element;
    }
    
    // Function to recreate all control spans cleanly
    function recreateControlSpans() {
        const controlSpans = document.querySelectorAll('.control-span');
        
        controlSpans.forEach(span => {
            try {
                // Save important properties
                const id = span.id;
                const className = span.className;
                const text = span.textContent;
                const onclickHandler = span.onclick;
                const isDisabled = span.classList.contains('disabled');
                
                // Create a completely new span with minimal attributes
                const newSpan = document.createElement('span');
                newSpan.id = id;
                newSpan.className = className;
                newSpan.textContent = text;
                
                // Copy onclick handler
                if (onclickHandler) {
                    newSpan.onclick = onclickHandler;
                }
                
                // Add appropriate ARIA attributes
                newSpan.setAttribute('role', 'button');
                newSpan.setAttribute('tabindex', '0');
                
                // Handle disabled state
                if (isDisabled) {
                    newSpan.setAttribute('aria-disabled', 'true');
                }
                
                // Replace the original span
                if (span.parentNode) {
                    span.parentNode.replaceChild(newSpan, span);
                    logButtonFix(`Recreated control span`, newSpan);
                }
            } catch (e) {
                console.error("Error recreating control span:", e);
            }
        });
        
        console.log("[Button Fix] Control spans recreated");
    }
    
    // Function to clean all existing buttons
    function cleanAllButtons() {
        const buttonElements = document.querySelectorAll('button, [role="button"], .control-span, .orb');
        console.log(`[Button Fix] Cleaning ${buttonElements.length} button elements`);
        
        buttonElements.forEach(element => {
            cleanupButtonAttributes(element);
        });
    }
    
    // Function to intercept button creation
    function setupButtonInterception() {
        // Override createElement to intercept button creation
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(document, tagName);
            
            // Clean all button-like elements immediately upon creation
            if (tagName.toLowerCase() === 'button' || 
                tagName.toLowerCase() === 'span' || 
                tagName.toLowerCase() === 'div') {
                
                // Use setTimeout to ensure this runs after all properties are set
                setTimeout(() => {
                    if (element.classList && 
                        (element.classList.contains('control-span') || 
                         element.getAttribute('role') === 'button' ||
                         element.tagName.toLowerCase() === 'button')) {
                        cleanupButtonAttributes(element);
                    }
                }, 0);
            }
            
            return element;
        };
        
        // Monitor DOM changes to clean any buttons added after initialization
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // Clean the node itself if it's a button
                            if (node.tagName === 'BUTTON' || 
                                (node.classList && node.classList.contains('control-span')) ||
                                node.getAttribute('role') === 'button' ||
                                (node.classList && node.classList.contains('orb'))) {
                                cleanupButtonAttributes(node);
                            }
                            
                            // Clean all buttons inside this node
                            if (node.querySelectorAll) {
                                const buttons = node.querySelectorAll('button, [role="button"], .control-span, .orb');
                                buttons.forEach(cleanupButtonAttributes);
                            }
                        }
                    });
                }
                
                // Also handle attribute changes
                if (mutation.type === 'attributes') {
                    const element = mutation.target;
                    if (element.tagName === 'BUTTON' || 
                        (element.classList && element.classList.contains('control-span')) ||
                        element.getAttribute('role') === 'button' ||
                        (element.classList && element.classList.contains('orb'))) {
                        cleanupButtonAttributes(element);
                    }
                }
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['iconName', 'layoutTraits', 'src', 'style', 'class', 'data-icon', 'data-src', 'data-layout']
        });
        
        console.log("[Button Fix] Button interception initialized");
    }
    
    // Initialize everything when DOM is ready
    function initButtonFixes() {
        console.log("[Button Fix] Initializing button fixes...");
        
        // Step 1: Clean all existing buttons
        cleanAllButtons();
        
        // Step 2: Recreate all control spans
        recreateControlSpans();
        
        // Step 3: Set up interception for future buttons
        setupButtonInterception();
        
        console.log("[Button Fix] Button fixes initialized successfully");
    }
    
    // Export functions to global scope
    window.cleanupButtonAttributes = cleanupButtonAttributes;
    window.cleanAllButtons = cleanAllButtons;
    window.recreateControlSpans = recreateControlSpans;
    window.initButtonFixes = initButtonFixes;
    
    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButtonFixes);
    } else {
        // DOM already loaded, run immediately
        initButtonFixes();
    }
    
    // Also run on load for good measure
    window.addEventListener('load', function() {
        // Wait a bit to ensure other scripts have run
        setTimeout(function() {
            cleanAllButtons();
            console.log("[Button Fix] Additional cleanup on window.load");
        }, 500);
    });
    
    console.log("Nag Button Fix module loaded");
})(); 