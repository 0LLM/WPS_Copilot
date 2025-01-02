### 技术点验证
1. 读取标准化的表单，AI获取知识后，填写到之前的表单里面
2. 识别哪些位置需要人填写
3. 支持每次可以上传多个文档（5个）


### 原始验证目标：

 原始格式化的表格（001），AI通过读取（002）下面的文档作为自己的私有知识，
完成001的里面需要填写的内容，输出标准化的文档，可以参考003里面的文档

### GPT的一些细节：

1. 识别小标题（小标题会根据每一个报告不同的格式改变，这个没有一些固定的名字）

2. 把小标题 正确的 对应到大标题中 （大标题是一些基本固定的类型）

3. 一种大标题下面的小标题们的写作手法和方式都是一样的，prompting也都是一样的

4. 根据prompting 结合上下文， 并且结合draft 文件内用户写的基本信息（有时候用户也不给draft 直接让你在空表格上写， 因为其他文件中应该已经有足够多的信息了）

5. 按照小标题的顺序填写。中间部分复杂的地方会结合最面前家庭或者别的因素【已经AI写完了的】 去完成下面难的部分

6. 有一些部分是要求必须要有额外信息文档上传的，AI要做判断，提供建议

a. Some preset question before start AI generate: 

b. Do you have Assistive Technology? - if yes, put down the name of the one you think should be chosen. And upload the equipments pdf comparison documents. 

c. Do you have Assessment? If yes, need to upload. 

d. 这两个部分需要网络上的信息和额外的文件支持，如果用户不提供，那么AI不能在表格中填写任何内容并且需要说明“NOT ADEQUATE INFORMATION TO PROVIDE SUGGESTIONS” 



### 后续考虑：

7.  如何处理敏感信息，如电话和姓名，用户隐私|敏感的保护，文件上传到在线大模型时需要把敏感信息 （名字，地址，电话…）屏蔽或者替换，AI大模型返回结果时需要把用户隐私|敏感的信息恢复。用本地开源大模型也可以保证隐私性但要考虑本地大模型性能如何