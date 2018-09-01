_G = ""
_VERSION = ""
function assert(v,message)
end
function collectgarbage(opt,arg)
end
function dofile(filename)
end
function error(message,level)
end
function getfenv(f)
end
function getmetatable(object)
end
function ipairs(t)
end
function load(func,chunkname)
end
function loadfile(filename)
end
function loadstring(string,chunkname)
end
function module(name,...)
end
function next(tablename,index)
end
function pairs(t)
end
function pcall(f,arg1,...)
end
function print(...)
end
function rawequal(v1,v2)
end
function rawget(tablename,index)
end
function rawset(tablename,index,value)
end
function require(modname)
end
function select(index,...)
end
function setfenv(f,tablename)
end
function setmetatable(tablename,metatable)
end
function tonumber(e,base)
end
function tostring(e)
end
function type(v)
end
function unpack(list,i,j)
end
function xpcall(f,err)
end

coroutine = {}
function coroutine.create(f)
end
function coroutine.resume(co,val1,...)
end
function coroutine.running()
end
function coroutine.status(co)
end
function coroutine.wrap(f)
end
function coroutine.yield(...)
end

debug = {}
function debug.debug()
end
function debug.getfenv(o)
end
function debug.gethook(thread)
end
function debug.getinfo(thread,funcname,what)
end
function debug.getlocal(thread,level,localname)
end
function debug.getmetatable(object)
end
function debug.getregistry()
end
function debug.getupvalue(func,up)
end
function debug.setfenv(object,tablename)
end
function debug.sethook(thread,hook,mask,count)
end
function debug.setlocal(thread,level,localname,value)
end
function debug.setmetatable(object,tablename)
end
function debug.setupvalue(func,up,value)
end
function debug.traceback(thread,message,level)
end

io = {}
function io.close(file)
end
function io.flush()
end
function io.input(file)
end
function io.lines(filename)
end
function io.open(filename,mode)
end
function io.output(file)
end
function io.popen(prog,mode)
end
function io.read(...)
end
function io.tmpfile()
end
function io.type(obj)
end
function io.write(...)
end

math = {}
function math.abs(x)
end
function math.acos(x)
end
function math.asin(x)
end
function math.atan(x)
end
function math.atan2(y,x)
end
function math.ceil(x)
end
function math.cos(x)
end
function math.cosh(x)
end
function math.deg(x)
end
function math.exp(x)
end
function math.floor(x)
end
function math.fmod(x,y)
end
function math.frexp(x)
end
math.huge = ""
function math.ldexp(m,e)
end
function math.log(x)
end
function math.log10(x)
end
function math.max(x,...)
end
function math.min(x,...)
end
function math.modf(x)
end
math.pi = ""
function math.pow(x,y)
end
function math.rad(x)
end
function math.random(m,n)
end
function math.randomseed(x)
end
function math.sin(x)
end
function math.sinh(x)
end
function math.sqrt(x)
end
function math.tan(x)
end
function math.tanh(x)
end

os = {}
function os.clock()
end
function os.date(format,time)
end
function os.difftime(t2,t1)
end
function os.execute(command)
end
function os.exit(code)
end
function os.getenv(varname)
end
function os.remove(filename)
end
function os.rename(oldname,newname)
end
function os.setlocale(locale,category)
end
function os.time(table)
end
function os.tmpname()
end

package = {}
package.cpath = ""
package.loaded = ""
package.loaders = ""
function package.loadlib(libname,funcname)
end
package.path = ""
package.preload = ""
function package.seeall(module)
end

string = {}
function string.byte(s,i,j)
end
function string.char(...)
end
function string.dump(funcname)
end
function string.find(s,pattern,init,plain)
end
function string.format(formatstring,...)
end
function string.gmatch(s,pattern)
end
function string.gsub(s,pattern,repl,n)
end
function string.len(s)
end
function string.lower(s)
end
function string.match(s,pattern,init)
end
function string.rep(s,n)
end
function string.reverse(s)
end
function string.sub(s,i,j)
end
function string.upper(s)
end

table = {}
function table.concat(tablename,sep,i,j)
end
function table.insert(tablename,pos,value)
end
function table.maxn(tablename)
end
function table.remove(tablename,pos)
end
function table.sort(tablename,comp)
end