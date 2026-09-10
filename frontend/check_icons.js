import * as icons from '@phosphor-icons/react';
const needed = ['MagnifyingGlass', 'House', 'Users', 'FileText', 'ShoppingBag', 'Plus', 'Bell', 'ChatTeardropText', 'X', 'Package', 'ShoppingCart', 'Wallet', 'UserPlus'];
const missing = needed.filter(n => !icons[n]);
console.log("Missing from site-header:", missing);
