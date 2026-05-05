document.addEventListener('DOMContentLoaded', function() {
    try {
        if (document.querySelector('main-menu')) {
            return;
        }
    } catch (_) {}

    // Get the Romaneios menu item
    const romaneiosMenu = document.querySelector('.menu-item-container .menu-item');
    const dropdownContent = document.querySelector('.menu-item-container .dropdown-content');
    
    // Add click event listener
    if (romaneiosMenu) {
        romaneiosMenu.addEventListener('click', function(e) {
            e.preventDefault();
            dropdownContent.classList.toggle('show-dropdown');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.matches('.menu-item-container .menu-item')) {
            if (dropdownContent && dropdownContent.classList.contains('show-dropdown')) {
                dropdownContent.classList.remove('show-dropdown');
            }
        }
    });

    // Close dropdown when clicking on a submenu item
    const dropdownItems = document.querySelectorAll('.dropdown-content a');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            if (dropdownContent) {
                dropdownContent.classList.remove('show-dropdown');
            }
        });
    });

    // Funções para os modais
    window.showAbout = function() {
        document.getElementById('aboutModal').style.display = 'block';
    }

    window.closeAboutModal = function() {
        document.getElementById('aboutModal').style.display = 'none';
    }

    window.showHelp = function() {
        document.getElementById('helpModal').style.display = 'block';
    }

    window.closeHelpModal = function() {
        document.getElementById('helpModal').style.display = 'none';
    }

    // Fechar modais ao clicar fora
    window.onclick = function(event) {
        const aboutModal = document.getElementById('aboutModal');
        const helpModal = document.getElementById('helpModal');
        
        if (event.target == aboutModal) {
            aboutModal.style.display = 'none';
        }
        if (event.target == helpModal) {
            helpModal.style.display = 'none';
        }
    }
}); 
